import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc, from }) }))

import { handleMcpMessage, isValidConnectorKey, TOOLS } from '@/lib/redactieConnector'
import { fillName, getPublishedText, libraryKey } from '@/lib/contentLibrary'
import { POST, GET } from '@/app/api/redactie/[sleutel]/route'

const KEY = 'k'.repeat(40)
const call = (name: string, args: unknown = {}, id: number | string = 1) =>
  handleMcpMessage({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) as Promise<any>
const payload = (response: any) => JSON.parse(response.result.content[0].text)
const bron = [{ naam: 'NOS', url: 'https://nos.nl/artikel/1' }]

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('REDACTIE_SLEUTEL', KEY)
  vi.useRealTimers()
})

describe('sleutel', () => {
  it('accepts only the configured key of at least 32 characters', () => {
    expect(isValidConnectorKey(KEY)).toBe(true)
    expect(isValidConnectorKey(`${KEY}x`)).toBe(false)
    expect(isValidConnectorKey(undefined)).toBe(false)
    vi.stubEnv('REDACTIE_SLEUTEL', 'kort')
    expect(isValidConnectorKey('kort')).toBe(false)
    vi.stubEnv('REDACTIE_SLEUTEL', '')
    expect(isValidConnectorKey('')).toBe(false)
  })
})

describe('MCP-protocol', () => {
  it('negotiates the protocol version and lists the tools', async () => {
    const init: any = await handleMcpMessage({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'babykrantje-redactie' } })
    const future: any = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2099-01-01' } })
    expect(future.result.protocolVersion).toBe('2025-11-25')
    const list: any = await handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    expect(list.result.tools.map((tool: any) => tool.name)).toEqual(['overzicht', 'lees_artikel', 'publiceer_artikel', 'stijlvoorbeelden'])
    for (const tool of TOOLS) expect(tool.inputSchema.type).toBe('object')
  })

  it('does not answer notifications and rejects unknown methods and tools', async () => {
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    expect(await handleMcpMessage({ jsonrpc: '2.0', id: 3, method: 'resources/list' })).toMatchObject({ error: { code: -32601 } })
    expect(await call('verwijder_alles')).toMatchObject({ error: { code: -32602 } })
    expect(await handleMcpMessage({ id: 4, method: 'ping' } as any)).toMatchObject({ error: { code: -32600 } })
    expect(await handleMcpMessage({ jsonrpc: '2.0', id: 'p', method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
  })
})

describe('tools', () => {
  it('publishes news with sources converted for the database', async () => {
    rpc.mockResolvedValueOnce({ data: { article_id: 'a', revision_id: 'r', version: 3 }, error: null })
    const response = await call('publiceer_artikel', { soort: 'nieuws', datum: '2025-03-04', tekst: '  De geboorte van [NAAM]...  ', bronnen: bron, notitie: 'eerste versie' })
    expect(response.result.isError).toBe(false)
    expect(payload(response)).toEqual({ gepubliceerd: true, soort: 'nieuws', datum: '2025-03-04', versie: 3 })
    expect(rpc).toHaveBeenCalledWith('publish_library_article', {
      p_type: 'news', p_key: '2025-03-04', p_body: 'De geboorte van [NAAM]...',
      p_sources: [{ name: 'NOS', url: 'https://nos.nl/artikel/1' }], p_note: 'eerste versie',
    })
  })

  it('stores culture under the Monday of the week', async () => {
    rpc.mockResolvedValueOnce({ data: { article_id: 'a', revision_id: 'r', version: 1 }, error: null })
    const response = await call('publiceer_artikel', { soort: 'cultuur', datum: '2025-03-06', tekst: 'Week', bronnen: [{ naam: 'Top 40', url: 'https://www.top40.nl/' }] })
    expect(payload(response)).toMatchObject({ soort: 'cultuur', week_van: '2025-03-03', week_tot: '2025-03-09' })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_type: 'culture', p_key: '2025-03-03' })
  })

  it('returns input problems as tool errors without touching the database', async () => {
    const cases = [
      { soort: 'weer', datum: '2025-03-04', tekst: 'x', bronnen: bron },
      { soort: 'nieuws', datum: '2025-02-30', tekst: 'x', bronnen: bron },
      { soort: 'nieuws', datum: '2999-01-01', tekst: 'x', bronnen: bron },
      { soort: 'nieuws', datum: '2025-03-04', tekst: '   ', bronnen: bron },
      { soort: 'nieuws', datum: '2025-03-04', tekst: 'x', bronnen: [] },
      { soort: 'nieuws', datum: '2025-03-04', tekst: 'x', bronnen: [{ naam: 'X', url: 'javascript:alert(1)' }] },
      { soort: 'nieuws', datum: '2025-03-04', tekst: 'x', bronnen: [{ naam: 'X', url: 'https://user:pw@nos.nl' }] },
      { soort: 'nieuws', datum: '2025-03-04', tekst: 'x', bronnen: bron, notitie: 'n'.repeat(1001) },
    ]
    for (const args of cases) expect((await call('publiceer_artikel', args)).result.isError).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reports database failures as tool errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Invalid source' } })
    const response = await call('publiceer_artikel', { soort: 'nieuws', datum: '2025-03-04', tekst: 'x', bronnen: bron })
    expect(response.result).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('bronnen') }] })
  })

  it('reads the published article and an old draft', async () => {
    rpc.mockResolvedValueOnce({ data: {
      article_id: 'a',
      published: { revision_id: 'r', version: 2, body: 'Tekst', sources: [{ name: 'NOS', url: 'https://nos.nl' }], published_at: '2025-03-05T08:00:00Z', note: null },
      draft: { body: 'Concept', sources: [], updated_at: '2025-03-04T08:00:00Z' },
    }, error: null })
    const result = payload(await call('lees_artikel', { soort: 'nieuws', datum: '2025-03-04' }))
    expect(result).toMatchObject({ datum: '2025-03-04', gepubliceerd: { versie: 2, tekst: 'Tekst' }, oud_concept: { tekst: 'Concept' } })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(payload(await call('lees_artikel', { soort: 'cultuur', datum: '2025-03-09' }))).toMatchObject({ week_van: '2025-03-03', gepubliceerd: null, oud_concept: null })
  })

  it('lists published, draft-only and missing days up to today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-05T12:00:00Z'))
    rpc.mockResolvedValueOnce({ data: [
      { key: '2025-03-02', version: 1, published_at: '2025-03-03T06:00:00Z', has_draft: false },
      { key: '2025-03-03', version: null, published_at: null, has_draft: true },
    ], error: null })
    const result = payload(await call('overzicht', { soort: 'nieuws', van: '2025-03-01', tot: '2025-03-10' }))
    expect(result.vandaag).toBe('2025-03-05')
    expect(result.gepubliceerd).toEqual([{ sleutel: '2025-03-02', versie: 1, gepubliceerd_op: '2025-03-03T06:00:00Z' }])
    expect(result.alleen_concept).toEqual(['2025-03-03'])
    expect(result.ontbreekt).toEqual(['2025-03-01', '2025-03-04', '2025-03-05'])
    expect((await call('overzicht', { soort: 'nieuws', van: '2024-01-01', tot: '2025-03-01' })).result.isError).toBe(true)
  })

  it('lists culture per week and defaults to the last 30 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-05T12:00:00Z'))
    rpc.mockResolvedValueOnce({ data: [], error: null })
    const result = payload(await call('overzicht', { soort: 'cultuur' }))
    expect(rpc).toHaveBeenCalledWith('library_overview', { p_type: 'culture', p_from: '2025-02-03', p_to: '2025-03-03' })
    expect(result.ontbreekt).toEqual(['2025-02-03', '2025-02-10', '2025-02-17', '2025-02-24', '2025-03-03'])
  })

  it('shares style examples without the personal opening paragraph', async () => {
    const chain: any = { select: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => ({
      data: [{ title: 'Voorbeeld', news_date: '2020-01-01', style_note: 'Kort', body: 'Familie Jansen is blij.\n\nKabinet presenteert plannen.\n\nAjax wint.' }], error: null,
    })) }
    from.mockReturnValueOnce(chain)
    const result = payload(await call('stijlvoorbeelden'))
    expect(result.voorbeelden[0].tekst).toBe('Kabinet presenteert plannen.\n\nAjax wint.')
    expect(JSON.stringify(result)).not.toContain('Jansen')
  })
})

describe('route', () => {
  const context = (sleutel: string) => ({ params: Promise.resolve({ sleutel }) })
  const post = (body: string, sleutel = KEY) => POST(new NextRequest('https://babykrantje.nl/api/redactie/x', {
    method: 'POST', body, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  }), context(sleutel))

  it('hides itself without the right key', async () => {
    expect((await post('{"jsonrpc":"2.0","id":1,"method":"ping"}', 'fout'.repeat(10))).status).toBe(404)
    expect((await GET(new NextRequest('https://babykrantje.nl/api/redactie/x'), context('fout'))).status).toBe(404)
  })

  it('answers requests, accepts notifications and has no event stream', async () => {
    const response = await post('{"jsonrpc":"2.0","id":7,"method":"ping"}')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ jsonrpc: '2.0', id: 7, result: {} })
    expect((await post('{"jsonrpc":"2.0","method":"notifications/initialized"}')).status).toBe(202)
    expect((await post('not json')).status).toBe(400)
    const batch = await post('[{"jsonrpc":"2.0","id":1,"method":"ping"},{"jsonrpc":"2.0","method":"notifications/initialized"}]')
    expect(await batch.json()).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
    const get = await GET(new NextRequest('https://babykrantje.nl/api/redactie/x'), context(KEY))
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
  })
})

describe('bibliotheek', () => {
  it('fills the name and maps culture dates to Monday', () => {
    expect(fillName('De geboorte van [NAAM]. [NAAM] slaapt.', 'Sem')).toBe('De geboorte van Sem. Sem slaapt.')
    expect(libraryKey('culture', '2025-01-01')).toBe('2024-12-30')
    expect(libraryKey('news', '2025-01-01')).toBe('2025-01-01')
    expect(() => libraryKey('news', '2025-02-29')).toThrow()
  })

  it('treats an unusable birth date as missing without querying', async () => {
    expect(await getPublishedText('news', '5 maart')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
