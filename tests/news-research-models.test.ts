import { afterEach, expect, it, vi } from 'vitest'
import { gatherNewsFacts, gatherCultuurFacts } from '@/lib/factGathering'
import { CLAUDE_MODEL } from '@/lib/prompts'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function mockProviders(claudeCitations = true) {
  vi.stubEnv('OPENAI_API_KEY', 'test'); vi.stubEnv('ANTHROPIC_API_KEY', 'test'); vi.stubEnv('GEMINI_API_KEY', '')
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('openai.com')
    ? { status: 'completed', usage: { input_tokens: 10 }, output: [{ type: 'message', content: [{ type: 'output_text', text: 'OpenAI feiten', annotations: [{ type: 'url_citation', title: 'Bron A', url: 'https://example.org/a' }] }] }] }
    : { stop_reason: 'end_turn', usage: { input_tokens: 20 }, content: [
      { type: 'server_tool_use', name: 'web_search' },
      { type: 'text', text: 'Claude feiten', citations: claudeCitations ? [{ type: 'web_search_result_location', title: 'Bron B', url: 'https://example.org/b' }] : [] },
      { type: 'text', text: 'Aanvullende context' },
    ] } }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

it('uses stronger bounded web researchers, keeps all text blocks and citations, leaves Haiku writing', async () => {
  const fetcher = mockProviders()
  const facts = await gatherNewsFacts('2026-08-31', true)
  const calls = fetcher.mock.calls as unknown as [string, { body: string }][]
  const openai = JSON.parse(calls.find(c => c[0].includes('openai.com'))![1].body)
  const claude = JSON.parse(calls.find(c => c[0].includes('anthropic.com'))![1].body)
  expect(openai.model).toBe('gpt-5.4-2026-03-05')
  expect(openai.tools[0].type).toBe('web_search')
  expect(openai.max_tool_calls).toBe(2)
  expect(openai.max_output_tokens).toBe(4000)
  expect(claude.model).toBe('claude-sonnet-4-6')
  expect(claude.tools[0].max_uses).toBe(2)
  expect(claude.max_tokens).toBe(3000)
  expect(facts.combined).toContain('Claude feiten\nAanvullende context')
  expect(facts.results[1].sources?.[0].url).toBe('https://example.org/b')
  expect(CLAUDE_MODEL).toBe('claude-haiku-4-5-20251001')
})

it('rejects Claude research without web citations', async () => {
  mockProviders(false)
  const facts = await gatherNewsFacts('2026-08-31', true)
  expect(facts.results[1].error).toContain('no web citations')
  expect(facts.results[1].text).toBe('')
})

it('keeps the existing culture models', async () => {
  const fetcher = mockProviders()
  await gatherCultuurFacts('2026-08-31')
  const calls = fetcher.mock.calls as unknown as [string, { body: string }][]
  expect(JSON.parse(calls[0][1].body).model).toBe('gpt-4o-mini')
  expect(JSON.parse(calls[1][1].body).model).toBe('claude-haiku-4-5')
  expect(JSON.parse(calls[1][1].body).tools).toBeUndefined()
})
