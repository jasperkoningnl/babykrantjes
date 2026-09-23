import { afterEach, expect, it, vi } from 'vitest'
import { callOpenAI, callOpenAIStructured } from '@/lib/openai'
import { PAPER_SCHEMA } from '@/lib/prompts'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const reply = (text: string, status = 'completed') => ({ status, usage: { input_tokens: 100, output_tokens: 50 },
  output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }] })

function mockFetch(payload: unknown, ok = true) {
  vi.stubEnv('OPENAI_API_KEY', 'test')
  const fetcher = vi.fn(async (_url: string, _init: { body: string }) => ({ ok, status: ok ? 200 : 500, text: async () => 'fout', json: async () => payload }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

it('writes with the configured writer model, without temperature', async () => {
  const fetcher = mockFetch(reply('  Een tekst  '))
  const result = await callOpenAI('prompt', 'systeem')
  const body = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(body).toMatchObject({ model: 'gpt-5.4-mini', instructions: 'systeem', input: 'prompt', store: false })
  expect(body.temperature).toBeUndefined()
  expect(result.text).toBe('Een tekst')
  expect(result.tokensUsed).toEqual({ input: 100, output: 50 })
})

it('rejects an incomplete response', async () => {
  mockFetch(reply('Half', 'incomplete'))
  await expect(callOpenAI('prompt', 'systeem')).rejects.toThrow('niet volledig')
})

it('rejects an API error and a missing key', async () => {
  mockFetch({}, false)
  await expect(callOpenAI('prompt', 'systeem')).rejects.toThrow('500')
  vi.stubEnv('OPENAI_API_KEY', '')
  await expect(callOpenAI('prompt', 'systeem')).rejects.toThrow('OPENAI_API_KEY')
})

it('refuses oversized input before calling the API', async () => {
  const fetcher = mockFetch(reply('x'))
  await expect(callOpenAI('x'.repeat(110 * 1024), 'systeem')).rejects.toThrow('te groot')
  expect(fetcher).not.toHaveBeenCalled()
})

it('requests a strict JSON schema and returns all paper sections', async () => {
  const sections = PAPER_SCHEMA.schema.required
  const fetcher = mockFetch(reply(JSON.stringify(Object.fromEntries(sections.map(s => [s, `tekst ${s}`])))))
  const result = await callOpenAIStructured<Record<string, string>>('prompt', 'systeem', PAPER_SCHEMA)
  const body = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'babykrant', strict: true })
  expect(body.text.format.schema.additionalProperties).toBe(false)
  expect(result.data.nieuws).toBe('tekst nieuws')
})

it('rejects structured output with a missing section or invalid JSON', async () => {
  mockFetch(reply(JSON.stringify({ nieuws: 'alleen nieuws' })))
  await expect(callOpenAIStructured('prompt', 'systeem', PAPER_SCHEMA)).rejects.toThrow('volledig')
  mockFetch(reply('geen json'))
  await expect(callOpenAIStructured('prompt', 'systeem', PAPER_SCHEMA)).rejects.toThrow('geldig')
})
