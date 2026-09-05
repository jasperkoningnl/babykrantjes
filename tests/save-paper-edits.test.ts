import { afterEach, describe, expect, it, vi } from 'vitest'
import { savePaperEdits } from '@/lib/savePaperEdits'

afterEach(() => vi.unstubAllGlobals())
describe('confirmed autosave', () => {
  it('rejects HTTP failures even when fetch resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"expired"}', { status: 401 })))
    await expect(savePaperEdits({ nieuws: 'Klanttekst' })).rejects.toThrow()
  })
  it('rejects missing server confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(savePaperEdits({ nieuws: 'Klanttekst' })).rejects.toThrow()
  })
  it('saves only private edits and accepts confirmed success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(savePaperEdits({ nieuws: 'Klanttekst' })).resolves.toBeUndefined()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ manualEdits: { nieuws: 'Klanttekst' } })
  })
})
