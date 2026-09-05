import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { withScrapeAuth } from '../supabase/functions/_shared/auth.ts'

const internalSecret = 'internal-scrape-secret-for-tests'

function request(headers: HeadersInit = {}): Request {
  return new Request('https://example.test/functions/v1/scrape-tv', { headers })
}

async function expectRejected(headers: HeadersInit): Promise<void> {
  const onAuthorized = vi.fn(async () => Response.json({ ok: true }))
  const response = await withScrapeAuth(request(headers), onAuthorized, () => internalSecret)

  expect(response.status).toBe(401)
  await expect(response.json()).resolves.toEqual({ ok: false, error: 'Unauthorized' })
  expect(onAuthorized).not.toHaveBeenCalled()
}

describe('scrape Edge Function service-to-service-authenticatie', () => {
  it('weigert een ontbrekende credential voordat privileged code draait', async () => {
    await expectRejected({})
  })

  it('weigert anon- en publishable keys op de platformheaders', async () => {
    await expectRejected({ Authorization: 'Bearer anon-jwt', apikey: 'anon-jwt' })
    await expectRejected({ apikey: 'sb_publishable_example' })
  })

  it('weigert een onjuiste interne secret', async () => {
    await expectRejected({ 'x-scrape-secret': 'incorrect' })
  })

  it('faalt dicht als de serversecret ontbreekt', async () => {
    const onAuthorized = vi.fn(async () => Response.json({ ok: true }))
    const response = await withScrapeAuth(
      request({ 'x-scrape-secret': internalSecret }),
      onAuthorized,
      () => undefined
    )

    expect(response.status).toBe(401)
    expect(onAuthorized).not.toHaveBeenCalled()
  })

  it('start de privileged code alleen met de dedicated secret', async () => {
    const onAuthorized = vi.fn(async () => Response.json({ ok: true }))
    const response = await withScrapeAuth(
      request({ 'x-scrape-secret': internalSecret }),
      onAuthorized,
      () => internalSecret
    )

    expect(response.status).toBe(200)
    expect(onAuthorized).toHaveBeenCalledOnce()
  })
})

describe('scrape-cron configuratie', () => {
  it('bewaart alleen Vault-lookups in idempotent vervangen cronjobs', () => {
    const migration = readFileSync('supabase/migrations/0002_cron.sql', 'utf8')

    expect(migration).toContain("from cron.job")
    expect(migration).toContain("select cron.unschedule(jobid)")
    expect(migration).toContain("name = 'scrape_function_secret'")
    expect(migration).toContain("'x-scrape-secret'")
    expect(migration).not.toContain('edge_function_secret_key')
    expect(migration).not.toMatch(/headers\s*:=\s*jsonb_build_object\('apikey'/)
  })
})
