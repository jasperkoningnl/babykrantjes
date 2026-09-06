import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildPrompt } from '@/lib/prompts'

const mocks = vi.hoisted(() => ({ admin: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: mocks.admin }))
vi.mock('@/lib/newsStyleExamples', () => ({ loadNewsStyleExamples: mocks.load }))
import { GET } from '@/app/api/admin/news/examples/route'

const example = { id: 'sample', title: 'Private Child', news_date: '2000-01-01', body: 'Private Child was born on 2000-01-01.\n\nA historical article with <markup>.', style_note: 'Compact context.' }
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue({ id: 'editor' }); mocks.load.mockResolvedValue([example]) })
it('returns the stored text only to an editor and prevents caching', async () => {
  const response = await GET(new NextRequest('https://example.test/api/admin/news/examples'))
  expect(await response.json()).toEqual({ examples: [example] })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})
it('does not read private examples for a visitor', async () => {
  mocks.admin.mockResolvedValue(null)
  const response = await GET(new NextRequest('https://example.test/api/admin/news/examples'))
  expect(response.status).toBe(401)
  expect(mocks.load).not.toHaveBeenCalled()
})
it('separates historical examples from new-day facts and gives current rules priority', () => {
  const data = { basisGegevens: { volledigeNaam: 'Test', geboorteDatum: '2026-09-01' }, newsStyleExamples: [example], gatheredFacts: { nieuws: 'NEW DAY FACTS' } }
  const prompt = buildPrompt('nieuws', data)
  expect(prompt).toContain('A historical article with &lt;markup&gt;.')
  expect(prompt).not.toContain('Private Child')
  expect(prompt).not.toContain('2000-01-01')
  expect(prompt).toContain('GEEN feitenbronnen')
  expect(prompt).toContain('actuele schrijfregels hierboven gaan voor')
  expect(prompt.indexOf('</style_examples>')).toBeLessThan(prompt.indexOf('NEW DAY FACTS'))
  expect(buildPrompt('hoofdartikel', data)).not.toContain(example.body)
})
