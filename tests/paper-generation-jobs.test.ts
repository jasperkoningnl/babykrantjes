import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('duurzame krantgeneratie', () => {
  it('maakt enqueue idempotent en koppelt iedere job aan een krant', () => {
    const migration = read('supabase/migrations/20260904000000_paper_generation_jobs.sql')
    expect(migration).toContain('paper_id uuid not null unique references public.generated_papers')
    expect(migration).toContain('idempotency_key text not null unique')
    expect(migration).toContain("check (status in ('queued', 'running', 'completed', 'failed'))")
    expect(migration).toContain('on conflict (idempotency_key) do nothing')
  })

  it('claimt met een lease en begrenst retries', () => {
    const migration = read('supabase/migrations/20260904000000_paper_generation_jobs.sql')
    expect(migration).toContain('attempts < max_attempts')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain("started_at < now() - interval '3 minutes'")
  })

  it('houdt generatie uit het browser-request', () => {
    const enqueue = read('app/api/paper-jobs/route.ts')
    const worker = read('app/api/cron/process-paper-jobs/route.ts')
    expect(enqueue).toContain("rpc('enqueue_paper_generation'")
    expect(enqueue).not.toContain('callClaudeStructured')
    expect(worker).toContain('processNextPaperGenerationJob')
  })
})
