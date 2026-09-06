import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), load: vi.fn(), gather: vi.fn(), archive: vi.fn() }))
vi.mock('@/lib/waybackResearch', () => ({ gatherWaybackResearch: mocks.archive }))
vi.mock('@/lib/newsStyleExamples', () => ({ loadNewsStyleExamples: async () => [{ id: 'example', title: 'Example', news_date: '2000-01-01', body: 'Historical style example', style_note: 'Short context' }] }))
vi.mock('@/lib/newsEditorial', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/newsEditorial')>(), loadNewsEditor: mocks.load }))
vi.mock('@/lib/factGathering', () => ({ gatherNewsFacts: mocks.gather }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }))
import { ADMIN_COOKIE, getAdminIdentity, isAdminEmail } from '@/lib/adminAuth'
import { validateNewsDraft } from '@/lib/newsEditorial'
import { POST } from '@/app/api/admin/news/route'
import { POST as generate } from '@/app/api/admin/news/generate/route'
import { buildPrompt, SYSTEM_PROMPT } from '@/lib/prompts'

afterEach(() => { vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY })

const request = (body: unknown, origin = 'https://example.test') => new NextRequest('https://example.test/api/admin/news', {
  method: 'POST', headers: { origin, cookie: `${ADMIN_COOKIE}=test-token`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.load.mockResolvedValue({ article: null, draft: null })
  mocks.archive.mockResolvedValue({ text: '', sources: [], results: [] })
  process.env.ADMIN_EMAILS = 'editor@example.test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test'
  delete process.env.NEWS_PILOT_ENABLED
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'trusted-id', email: 'editor@example.test', email_confirmed_at: '2026-01-01' } }, error: null })
})

describe('editor access', () => {
  it('uses both researchers and the existing newspaper prompt, then saves the result as a draft', async () => {
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const results = [{ model: 'chatgpt', text: 'Dagfeiten', sources: [{ name: 'Bron', url: 'https://example.test/news' }], durationMs: 1 }, { model: 'claude', text: 'Context', durationMs: 1 }]
    mocks.gather.mockResolvedValue({ results, combined: 'Dagfeiten en context' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Geboortekranttekst' }], stop_reason: 'end_turn', usage: { input_tokens: 20, output_tokens: 10 } }) })
    vi.stubGlobal('fetch', fetchMock)
    const response = await generate(request({ date: '2025-01-01', version: 0 }))
    expect(response.status).toBe(200)
    expect(mocks.gather).toHaveBeenCalledWith('2025-01-01', true)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.system).toBe(SYSTEM_PROMPT)
    expect(sent.messages[0].content).toBe(buildPrompt('nieuws', { basisGegevens: { volledigeNaam: '[NAAM]', geboorteDatum: '2025-01-01' }, gatheredFacts: { nieuws: 'Dagfeiten en context' }, newsStyleExamples: [{ id: 'example', title: 'Example', news_date: '2000-01-01', body: 'Historical style example', style_note: 'Short context' }] }))
    expect(sent.messages[0].content).toContain('Historical style example')
    expect(sent.messages[0].content).toContain('Geen ongelukken, rampen of doden als opening')
    expect(sent.messages[0].content).toContain('Kies 5-8 nieuwsitems')
    const saved = mocks.rpc.mock.calls.find(c => c[0] === 'save_news_draft')![1]
    expect(saved.p_actor_id).toBe('trusted-id')
    expect(saved.p_facts.generation.researchers).toEqual(results)
    expect(saved.p_body).toBe('Geboortekranttekst')
    expect(mocks.rpc.mock.calls.some(c => c[0] === 'publish_news_draft')).toBe(false)
  })
  it('does not pay for generation when the displayed version is stale', async () => {
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    mocks.load.mockResolvedValueOnce({ article: { editorial_version: 1 }, draft: { body: 'Editor work' } })
    expect((await generate(request({ date: '2025-01-01', version: 0 }))).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('regenerates an existing draft with archive evidence and preserves its version guard', async () => {
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    mocks.load.mockResolvedValue({ article: { editorial_version: 3 }, draft: { body: 'Old article' } })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    mocks.gather.mockResolvedValue({ results: [{ text: 'Facts', sources: [{ name: 'Source', url: 'https://example.test' }] }, { text: 'Context' }], combined: 'Facts and context' })
    mocks.archive.mockResolvedValue({ text: 'Archive context', sources: [{ name: 'NOS archive', url: 'https://web.archive.org/web/20250101180000/https://nos.nl/' }], results: [{ name: 'NOS', status: 'Available' }] })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'New article' }], stop_reason: 'end_turn' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect((await generate(request({ date: '2025-01-01', version: 3 }))).status).toBe(200)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toContain('Archive context')
    const saved = mocks.rpc.mock.calls.find(c => c[0] === 'save_news_draft')![1]
    expect(saved.p_expected_version).toBe(3)
    expect(saved.p_body).toBe('New article')
    expect(saved.p_facts.generation.archive).toEqual([{ name: 'NOS', status: 'Available' }])
  })
  it('retains server-side research metadata when saving an edited article', async () => {
    mocks.load.mockResolvedValue({ draft: { facts: { generation: { id: 'saved-generation' } } } })
    mocks.rpc.mockResolvedValue({ error: null })
    expect((await POST(request({ action: 'save', date: '2025-01-01', body: 'Edited', facts: 'Research', sources: [{ name: 'Source', url: 'https://example.test' }], version: 1 }))).status).toBe(200)
    expect(mocks.rpc.mock.calls[0][1].p_facts.generation.id).toBe('saved-generation')
  })
  it('does not write an article when either researcher failed', async () => {
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    mocks.gather.mockResolvedValue({ results: [{ text: 'Facts' }, { text: '', error: 'timeout' }], combined: 'Facts' })
    vi.stubGlobal('fetch', vi.fn())
    expect((await generate(request({ date: '2025-01-01', version: 0 }))).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
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
    process.env.NEWS_PILOT_ENABLED = 'true'; process.env.ANTHROPIC_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    const result = await generate(request({ date: '2025-01-01', version: 0 }))
    expect(result.status).toBe(429)
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
  })
  it('rejects invalid dates and unsafe source links', () => {
    const draft = { date: '2025-01-01', body: 'News', facts: 'Facts', version: 0, sources: [{ name: 'source', url: 'javascript:alert(1)' }] }
    expect(() => validateNewsDraft(draft)).toThrow()
    expect(() => validateNewsDraft({ ...draft, date: '2025-02-29' })).toThrow()
  })
})
