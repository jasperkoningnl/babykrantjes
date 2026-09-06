import { afterEach, expect, it, vi } from 'vitest'
import { gatherWaybackResearch } from '@/lib/waybackResearch'

afterEach(() => vi.unstubAllGlobals())
it('retrieves both sources using exact-day captures and the existing headline parsers', async () => {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input)
    if (url.pathname.includes('/cdx/')) return new Response(JSON.stringify([
      ['timestamp', 'original'], ['20250102180000', 'https://nos.nl/'],
      ['20250101180000', `https://${url.searchParams.get('url')}`],
    ]))
    return new Response('<h3>Een belangrijke ontwikkeling in het nieuws vandaag</h3>')
  })
  vi.stubGlobal('fetch', fetchMock)
  const result = await gatherWaybackResearch('2025-01-01')
  expect(result.sources).toHaveLength(2)
  expect(result.text).toContain('Een belangrijke ontwikkeling')
  expect(result.text).toContain('geen volledige artikelen')
  expect(result.sources.every(s => s.url.includes('20250101180000id_'))).toBe(true)
})
it('does not fetch out-of-day or foreign-host records', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
    ['timestamp', 'original'], ['20250102120000', 'https://nos.nl/'], ['20250101120000', 'https://example.test/'],
  ])))
  vi.stubGlobal('fetch', fetchMock)
  const result = await gatherWaybackResearch('2025-01-01')
  expect(result.sources).toEqual([])
  expect(result.text).toBe('')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('reports unavailable archives without blocking the other researchers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')))
  const result = await gatherWaybackResearch('2025-01-01')
  expect(result.text).toBe('')
  expect(result.results.every(r => r.status.includes('niet bereikbaar'))).toBe(true)
})
