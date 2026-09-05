import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Dedicated disposable database only. CI uses PostgreSQL for real concurrent sessions;
// local runs default to in-memory PostgreSQL (PGlite), not a SQL mock.
const url = process.env.CONTENT_TEST_DATABASE_URL
if (url && new URL(url).pathname !== '/babykrant_content_test') {
  throw new Error('Database tests require a disposable database named babykrant_content_test')
}
const pool = url ? new Pool({ connectionString: url, max: 8 }) : null
const embedded = pool ? null : new PGlite()
const query = async (sql: string, params: unknown[] = []) => {
  if (pool) return (await pool.query(sql, params)).rows
  return (await embedded!.query(sql, params)).rows as Record<string, any>[]
}
const exec = async (sql: string) => {
  if (pool) await pool.query(sql)
  else await embedded!.exec(sql)
}
const actor = '11111111-1111-4111-8111-111111111111'
const sources = JSON.stringify([{ name: 'NOS', url: 'https://nos.nl/artikel/example', date: '2025-01-01' }])
const enqueue = (date = '2025-01-01') => query('select * from public.enqueue_news_job($1)', [date])
const claim = () => query('select * from public.claim_news_job(300)')
const complete = (job: Record<string, any>, body = 'Nieuwsartikel', sourceJson = sources) => query(
  `select public.complete_news_job($1, $2, $3, '{}'::jsonb, $4::jsonb, '{}'::jsonb, 'recent_year', 'test') as id`,
  [job.id, job.lock_token, body, sourceJson],
)
const publish = (article: string, revision: string, expected: string | null = null) => query(
  'select public.publish_article_revision($1, $2, $3, $4, $5)', [article, revision, expected, actor, 'Bronnen gecontroleerd'],
)

beforeAll(async () => {
  await exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
    end $$;
    grant usage on schema public to anon, authenticated, service_role;
  `)
  await exec(readFileSync(new URL('../supabase/migrations/20260905101814_content_library_news_foundation.sql', import.meta.url), 'utf8'))
  await exec(readFileSync(new URL('../supabase/migrations/20260905115345_news_editorial_review.sql', import.meta.url), 'utf8'))
  await exec("notify pgrst, 'reload schema'")
}, 60_000)

beforeEach(async () => {
  await exec('truncate public.article_publications, public.article_revisions, public.news_articles, public.articles, public.content_jobs cascade')
  await exec('update public.news_pilot_budget set reserved_cents = 0')
})
afterAll(async () => { if (pool) await pool.end(); else await embedded!.close() })

describe('news foundation migration', () => {
  it('saves concepts without revision growth, detects stale saves and publishes an immutable snapshot', async () => {
    const save = (body: string, version: number) => query("select * from public.save_news_draft('2025-01-01', $1, '{}', $2, $3, $4)", [body, sources, version, actor])
    const [first] = await save('Concept', 0)
    const [second] = await save('Verbeterd concept', 1)
    expect(await query('select * from public.article_revisions')).toHaveLength(0)
    await expect(save('Stale text', 1)).rejects.toThrow(/changed/)
    await query('select public.publish_news_draft($1, $2, null, $3, $4)', [first.article_id, second.edit_version, actor, 'Bronnen gecontroleerd'])
    expect(await query('select body from public.article_revisions')).toEqual([{ body: 'Verbeterd concept' }])
    expect(await query('select * from public.article_drafts')).toHaveLength(0)
    await expect(save('Stale first tab', 0)).rejects.toThrow(/changed/)
    await save('Volgende correctie', 3)
    await expect(save('Old draft version', 1)).rejects.toThrow(/changed/)
  })

  it('caps concurrent pilot reservations at five euros without resetting on retries', async () => {
    const reservations = await Promise.all(Array.from({ length: 10 }, () => query('select public.reserve_news_pilot_attempt() as ok')))
    expect(reservations.filter(rows => rows[0].ok)).toHaveLength(5)
    expect((await query('select reserved_cents from public.news_pilot_budget'))[0].reserved_cents).toBe(500)
  })

  it.skipIf(!process.env.CONTENT_TEST_REST_URL)('enforces roles through PostgREST and exposes working RPCs to service workers', async () => {
    const rest = process.env.CONTENT_TEST_REST_URL!
    const jwt = (role: string) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now()/1000)+300 })).toString('base64url')
      const content = `${header}.${payload}`
      return `${content}.${createHmac('sha256', process.env.CONTENT_TEST_JWT_SECRET!).update(content).digest('base64url')}`
    }
    const headers = (role: string) => ({ Authorization: `Bearer ${jwt(role)}`, 'Content-Type': 'application/json' })
    for (let attempt = 0; attempt < 20; attempt++) {
      const ready = await fetch(`${rest}/articles`, { headers: headers('service_role') }).catch(() => null)
      if (ready?.ok) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    for (const role of ['anon', 'authenticated']) {
      // PostgREST maps insufficient privilege to 401 for its anonymous role, 403 otherwise.
      const denied = await fetch(`${rest}/articles`, { headers: headers(role) })
      expect(denied.status).toBe(role === 'anon' ? 401 : 403)
      expect(await denied.json()).toMatchObject({ code: '42501' })
      const deniedRpc = await fetch(`${rest}/rpc/enqueue_news_job`, { method: 'POST', headers: headers(role), body: JSON.stringify({ p_date: '2025-01-01' }) })
      expect(deniedRpc.status).toBe(role === 'anon' ? 401 : 403)
      expect(await deniedRpc.json()).toMatchObject({ code: '42501' })
    }
    const response = await fetch(`${rest}/rpc/enqueue_news_job`, { method: 'POST', headers: headers('service_role'), body: JSON.stringify({ p_date: '2025-01-01' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'queued' })
  }, 20_000)
  it('deduplicates five requests and claims exactly one worker', async () => {
    const jobs = await Promise.all(Array.from({ length: 5 }, () => enqueue()))
    expect(new Set(jobs.map(rows => rows[0].id)).size).toBe(1)
    const claims = (await Promise.all(Array.from({ length: 5 }, claim))).flat()
    expect(claims).toHaveLength(1)
    const completions = await Promise.all(Array.from({ length: 5 }, () => complete(claims[0])))
    expect(new Set(completions.map(rows => rows[0].id)).size).toBe(1)
    const [first] = completions[0]
    const [retry] = await complete(claims[0], 'Must not overwrite')
    expect(retry.id).toBe(first.id)
    expect(await query('select body from public.article_revisions')).toEqual([{ body: 'Nieuwsartikel' }])
    expect(await query('select * from public.news_articles')).toHaveLength(1)
    expect((await enqueue())[0].status).toBe('completed')
    expect(await claim()).toHaveLength(0)
  })

  it('rejects stale workers after recovery and caps expired attempts', async () => {
    await enqueue()
    const [old] = await claim()
    const expire = () => exec(`update public.content_jobs set locked_at = now() - interval '10 minutes', lease_expires_at = now() - interval '1 second' where status = 'running'`)
    await expire()
    const [current] = await claim()
    expect(current.lock_token).not.toBe(old.lock_token)
    await expect(complete(old)).rejects.toThrow(/Stale job claim/)
    expect((await query('select public.fail_news_job($1, $2, $3) as ok', [old.id, old.lock_token, 'timeout']))[0].ok).toBe(false)
    await expire()
    expect((await claim())[0].attempts).toBe(3)
    await expire()
    expect(await claim()).toHaveLength(0)
    expect((await query('select status from public.content_jobs'))[0].status).toBe('failed')
  })

  it('backs off retries and rejects unstructured error logs', async () => {
    await enqueue()
    const [job] = await claim()
    await expect(query('select public.fail_news_job($1, $2, $3)', [job.id, job.lock_token, 'Private customer text!'])).rejects.toThrow(/Invalid error code/)
    expect((await query('select public.fail_news_job($1, $2, $3) as ok', [job.id, job.lock_token, 'provider_timeout']))[0].ok).toBe(true)
    expect(await claim()).toHaveLength(0)
    await exec("update public.content_jobs set available_at = now() - interval '1 second'")
    expect((await claim())[0].attempts).toBe(2)
  })

  it('rolls back all article writes on invalid completion and requires sources', async () => {
    await enqueue()
    const [job] = await claim()
    await expect(complete(job, '   ')).rejects.toThrow()
    expect(await query('select * from public.articles')).toHaveLength(0)
    expect((await query('select status from public.content_jobs'))[0].status).toBe('running')
    await expect(complete(job, 'Nieuws', '[]')).rejects.toThrow(/Primary sources/)
    await expect(complete(job, 'Nieuws', '[{"name":"Model"}]')).rejects.toThrow(/Invalid primary source/)
    await expect(enqueue('2025-02-29')).rejects.toThrow()
    await expect(enqueue('9999-01-01')).rejects.toThrow(/future news date/)
    await expect(query('select * from public.claim_news_job(0)')).rejects.toThrow(/Invalid lease/)
  })

  it('enforces ownership, publication, immutable snapshots and optimistic locking', async () => {
    await enqueue()
    const [revision] = await complete((await claim())[0])
    const [article] = await query('select * from public.articles')
    expect(article.current_revision_id).toBeNull()
    await expect(query('update public.articles set current_revision_id = $1 where id = $2', [revision.id, article.id])).rejects.toThrow(/must be published/)
    await publish(article.id, revision.id)
    await expect(query("update public.article_revisions set body = 'changed' where id = $1", [revision.id])).rejects.toThrow(/immutable/)
    await expect(query('delete from public.article_revisions where id = $1', [revision.id])).rejects.toThrow(/retained/)
    const [next] = await query(`insert into public.article_revisions(article_id, version, body, facts_snapshot, sources_snapshot, created_by_type)
      values ($1, 2, 'Correctie', '{}', $2, 'editor') returning id`, [article.id, sources])
    await expect(publish(article.id, next.id)).rejects.toThrow(/reload/)
    await publish(article.id, next.id, revision.id)
    expect((await query('select body from public.article_revisions where id = $1', [revision.id]))[0].body).toBe('Nieuwsartikel')
    expect(await query('select * from public.article_publications')).toHaveLength(2)
    const [other] = await query("insert into public.articles(article_type) values ('news') returning id")
    await expect(publish(other.id, revision.id)).rejects.toThrow(/does not belong/)
    await expect(query('update public.articles set current_revision_id = $1 where id = $2', [revision.id, other.id])).rejects.toThrow()
    await expect(query(`insert into public.article_revisions(article_id, version, body, facts_snapshot, sources_snapshot, created_by_type)
      values ($1, 2, 'Duplicate', '{}', $2, 'editor')`, [article.id, sources])).rejects.toThrow(/unique/)
  })

  it('prevents attaching a news detail to another article type', async () => {
    const [article] = await query("insert into public.articles(article_type) values ('culture') returning id")
    await expect(query(`insert into public.news_articles(article_id, news_date, coverage_tier, research_method)
      values ($1, '2025-01-01', 'recent_year', 'test')`, [article.id])).rejects.toThrow(/foreign key/)
  })

  it('enables RLS and denies public table and RPC access while allowing service workers', async () => {
    const tables = ['articles', 'news_articles', 'article_revisions', 'content_jobs', 'article_publications']
    for (const table of tables) {
      expect((await query('select relrowsecurity from pg_class where oid = $1::regclass', [`public.${table}`]))[0].relrowsecurity).toBe(true)
      for (const role of ['anon', 'authenticated']) {
        expect((await query("select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as allowed", [role, `public.${table}`]))[0].allowed).toBe(false)
      }
    }
    for (const role of ['anon', 'authenticated']) {
      expect((await query("select has_function_privilege($1, 'public.enqueue_news_job(date)', 'EXECUTE') as allowed", [role]))[0].allowed).toBe(false)
    }
    // SET ROLE requires one connection. PGlite is single-session; use a pinned PG client.
    const client = pool ? await pool.connect() : null
    const roleExec = (sql: string) => client ? client.query(sql) : embedded!.exec(sql)
    try {
      await roleExec('set role anon')
      await expect(roleExec('select * from public.articles')).rejects.toThrow(/permission denied/)
      await expect(roleExec("select public.enqueue_news_job('2025-01-01')")).rejects.toThrow(/permission denied/)
      await roleExec('reset role; set role service_role')
      await roleExec("select public.enqueue_news_job('2025-01-01')")
      await roleExec('select * from public.claim_news_job(300)')
      await roleExec(`select public.complete_news_job(id, lock_token, 'Test', '{}', '[{"name":"NOS","url":"https://nos.nl"}]', '{}', 'recent_year', 'test') from public.content_jobs`)
      await roleExec(`select public.publish_article_revision(article_id, id, null, '${actor}', 'Review') from public.article_revisions`)
      await expect(roleExec('delete from public.article_publications')).rejects.toThrow(/permission denied/)
    } finally {
      await roleExec('reset role')
      client?.release()
    }
  })
})
