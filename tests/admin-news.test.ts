import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }))
import { ADMIN_COOKIE, getAdminIdentity, isAdminEmail } from '@/lib/adminAuth'
import { validateNewsDraft } from '@/lib/newsEditorial'
import { POST } from '@/app/api/admin/news/route'
import { POST as generate } from '@/app/api/admin/news/generate/route'

const request = (body: unknown, origin = 'https://example.test') => new NextRequest('https://example.test/api/admin/news', {
  method: 'POST', headers: { origin, cookie: `${ADMIN_COOKIE}=test-token`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_EMAILS = 'editor@example.test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test'
  delete process.env.NEWS_PILOT_ENABLED
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'trusted-id', email: 'editor@example.test', email_confirmed_at: '2026-01-01' } }, error: null })
})

describe('editor access', () => {
  it('requires a server-verified, confirmed, allowlisted identity', async () => {
    expect(await getAdminIdentity()).toBeNull()
    expect(isAdminEmail('other@example.test')).toBe(false)
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'attacker', email: 'other@example.test', email_confirmed_at: 'now', user_metadata: { admin: true } } } })
    expect(await getAdminIdentity('token')).toBeNull()
    mocks.getUser.mockResolvedValueOnce({ data: { user: { email: 'editor@example.test' } } })
    expect(await getAdminIdentity('token')).toBeNull()
  })
  it('rejects cross-origin mutations before touching the database', async () => {
    expect((await POST(request({}, 'https://evil.test'))).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a guest and never trusts a client-supplied actor', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await POST(request({ action: 'publish' }))).status).toBe(401)
    mocks.rpc.mockResolvedValue({ data: 'revision', error: null })
    expect((await POST(request({ action: 'publish', articleId: 'a', version: 1, currentRevisionId: null, reviewed: true, reason: 'Checked', actorId: 'attacker' }))).status).toBe(200)
    expect(mocks.rpc.mock.calls[0][1].p_actor_id).toBe('trusted-id')
  })
  it('requires explicit review before publication', async () => {
    expect((await POST(request({ action: 'publish', reviewed: false, reason: 'Checked' }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('keeps generation disabled by default and fails closed when the budget is exhausted', async () => {
    expect((await generate(request({}))).status).toBe(503)
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    const result = await generate(request({ date: '2025-01-01', facts: 'Checked facts', sources: [{ name: 'NOS', url: 'https://nos.nl/' }] }))
    expect(result.status).toBe(429)
    delete process.env.ANTHROPIC_API_KEY
  })
  it('rejects invalid dates and unsafe source links', () => {
    const draft = { date: '2025-01-01', body: 'News', facts: 'Facts', version: 0, sources: [{ name: 'source', url: 'javascript:alert(1)' }] }
    expect(() => validateNewsDraft(draft)).toThrow()
    expect(() => validateNewsDraft({ ...draft, date: '2025-02-29' })).toThrow()
  })
})
