import { afterEach, expect, it, vi } from 'vitest'
import { gatherNewsFacts, gatherCultuurFacts } from '@/lib/factGathering'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function mockOpenAI(citations = true) {
  vi.stubEnv('OPENAI_API_KEY', 'test')
  const fetcher = vi.fn(async (_url: string, _init: { body: string }) => ({ ok: true, json: async () => ({
    status: 'completed', usage: { input_tokens: 10 },
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [{ type: 'output_text', text: 'OpenAI feiten',
        annotations: citations ? [{ type: 'url_citation', title: 'Bron A', url: 'https://example.org/a' }, { type: 'url_citation', title: 'Bron A', url: 'https://example.org/a' }] : [] }] },
    ],
  }) }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

it('researches news with one bounded OpenAI web search call', async () => {
  const fetcher = mockOpenAI()
  const facts = await gatherNewsFacts('2026-08-31')
  expect(fetcher).toHaveBeenCalledTimes(1)
  const [url, init] = fetcher.mock.calls[0]
  const body = JSON.parse(init.body)
  expect(url).toBe('https://api.openai.com/v1/responses')
  expect(body.model).toBe('gpt-5.4-2026-03-05')
  expect(body.tools[0].type).toBe('web_search')
  expect(body.max_tool_calls).toBe(2)
  expect(body.max_output_tokens).toBe(4000)
  expect(body.store).toBe(false)
  expect(facts.results).toHaveLength(1)
  expect(facts.results[0].sources).toEqual([{ name: 'Bron A', url: 'https://example.org/a' }])
  expect(facts.combined).toContain('OpenAI feiten')
})

it('rejects research without web citations', async () => {
  mockOpenAI(false)
  const facts = await gatherNewsFacts('2026-08-31')
  expect(facts.results[0].error).toContain('no web citations')
  expect(facts.results[0].text).toBe('')
  expect(facts.combined).toBe('')
})

it('researches culture with OpenAI web search as the leading source', async () => {
  const fetcher = mockOpenAI()
  const facts = await gatherCultuurFacts('2026-08-31')
  expect(fetcher).toHaveBeenCalledTimes(1)
  const body = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(body.tools[0].type).toBe('web_search')
  expect(body.max_tool_calls).toBe(3)
  expect(facts.results[0].sources).toHaveLength(1)
})

it('honours the configured research model', async () => {
  const fetcher = mockOpenAI()
  vi.stubEnv('OPENAI_RESEARCH_MODEL', 'gpt-test')
  await gatherNewsFacts('2026-08-31')
  expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('gpt-test')
})

it('never calls another AI provider', async () => {
  const fetcher = mockOpenAI()
  await Promise.all([gatherNewsFacts('2026-08-31'), gatherCultuurFacts('2026-08-31')])
  expect(fetcher.mock.calls.every(([url]) => url.startsWith('https://api.openai.com/'))).toBe(true)
})
