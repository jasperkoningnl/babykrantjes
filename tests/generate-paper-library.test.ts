import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), loadState: vi.fn() }))
vi.mock('@/lib/paperSession', () => ({ findPaperSession: vi.fn(async () => ({ paperId: 'paper' })) }))
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 3 })),
  reserveDailyCost: vi.fn(async () => ({ ok: true })),
  settleDailyCost: vi.fn(async () => undefined),
}))
vi.mock('@/lib/paperState', () => ({ loadPaperState: mocks.loadState }))
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc, from: () => ({ update: (value: unknown) => { mocks.update(value); return { eq: async () => ({ error: null }) } } }) }),
}))

import { POST as generatePaper } from '@/app/api/generate-paper/route'
import { POST as generateArticle } from '@/app/api/generate-article/route'
import { AI_SECTIONS } from '@/lib/prompts'

const state = { basisGegevens: { volledigeNaam: 'Sem de Vries', geboorteDatum: '2025-03-05', geboorteplaats: 'Utrecht' } }
const published = (body: string) => ({ data: { article_id: 'a', published: { body }, draft: null }, error: null })
const request = (url: string, body = {}) => new NextRequest(url, { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.stubEnv('OPENAI_API_KEY', 'test')
  mocks.loadState.mockResolvedValue(structuredClone(state))
})

describe('krant uit de redactiebibliotheek', () => {
  it('uses published news and culture and asks the writer only for the other sections', async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: any) => args.p_type === 'news'
      ? published('De geboorte van [NAAM] is het belangrijkste nieuws.') : published('In de week van [NAAM] stond Snelle op 1.'))
    const fetcher = vi.fn(async (_url: string, init: { body: string }) => ({ ok: true, json: async () => ({
      status: 'completed', usage: { input_tokens: 10, output_tokens: 10 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(Object.fromEntries(AI_SECTIONS.map(s => [s, `tekst ${s}`]))) }] }],
    }), text: async () => init.body }))
    vi.stubGlobal('fetch', fetcher)

    const response = await generatePaper(request('https://babykrantje.nl/api/generate-paper'))
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.articles.nieuws).toBe('De geboorte van Sem is het belangrijkste nieuws.')
    expect(result.articles.cultuur).toBe('In de week van Sem stond Snelle op 1.')
    expect(result.articles.hoofdartikel).toBe('tekst hoofdartikel')
    expect(mocks.rpc).toHaveBeenCalledWith('library_article', { p_type: 'news', p_key: '2025-03-05' })
    expect(mocks.rpc).toHaveBeenCalledWith('library_article', { p_type: 'culture', p_key: '2025-03-03' })
    // Eén call: het schrijfmodel, zonder websearch-onderzoek en zonder nieuws- of cultuursectie.
    expect(fetcher).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(sent.tools).toBeUndefined()
    expect(Object.keys(sent.text.format.schema.properties)).toEqual([...AI_SECTIONS])
    expect(sent.input).not.toContain('SECTIE "nieuws"')
    expect(sent.input).not.toContain('SECTIE "cultuur"')
  })

  it('leaves missing library sections empty instead of inventing them', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      status: 'completed', usage: {}, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(Object.fromEntries(AI_SECTIONS.map(s => [s, 'x']))) }] }],
    }) })))
    const result = await (await generatePaper(request('https://babykrantje.nl/api/generate-paper'))).json()
    expect(result.articles).toMatchObject({ nieuws: '', cultuur: '' })
  })

  it('refreshes a library section without AI costs', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    vi.stubEnv('OPENAI_API_KEY', '')
    mocks.rpc.mockResolvedValueOnce(published('Nieuws voor [NAAM].'))
    const ok = await (await generateArticle(request('https://babykrantje.nl/api/generate-article', { section: 'nieuws' }))).json()
    expect(ok).toMatchObject({ success: true, text: 'Nieuws voor Sem.', cost: 0 })
    expect(mocks.update).toHaveBeenCalledWith({ manual_edits: { nieuws: 'Nieuws voor Sem.' } })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    const missing = await generateArticle(request('https://babykrantje.nl/api/generate-article', { section: 'cultuur' }))
    expect(missing.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
