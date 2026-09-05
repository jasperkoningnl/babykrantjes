import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ from, rpc }) }))
import { getPublishedNews, enqueueNewsJob, claimNewsJob } from '@/lib/contentLibrary'

function result(data: unknown, error: unknown = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), maybeSingle: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.not.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue({ data, error })
  return chain
}
beforeEach(() => vi.clearAllMocks())

describe('published news repository', () => {
  it('returns no draft when there is no publication pointer', async () => {
    from.mockReturnValueOnce(result({ article_id: 'article' })).mockReturnValueOnce(result({ current_revision_id: null }))
    expect(await getPublishedNews('2025-01-01')).toBeNull()
    expect(from).toHaveBeenCalledTimes(2)
  })
  it('reads the exact published revision even while another revision needs review', async () => {
    const revision = result({ id: 'published', body: 'Approved text', published_at: '2025-01-02' })
    from.mockReturnValueOnce(result({ article_id: 'article' }))
      .mockReturnValueOnce(result({ current_revision_id: 'published', editorial_status: 'needs_review' }))
      .mockReturnValueOnce(revision)
    expect(await getPublishedNews('2025-01-01')).toMatchObject({ body: 'Approved text' })
    expect(revision.eq).toHaveBeenCalledWith('id', 'published')
    expect(revision.eq).toHaveBeenCalledWith('article_id', 'article')
    expect(revision.not).toHaveBeenCalledWith('published_at', 'is', null)
  })
  it('distinguishes missing content from a database outage', async () => {
    from.mockReturnValueOnce(result(null, new Error('Database unavailable')))
    await expect(getPublishedNews('2025-01-01')).rejects.toThrow('Database unavailable')
  })
  it('validates dates before issuing a job and returns null for an empty queue', async () => {
    await expect(enqueueNewsJob('2025-02-29')).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await claimNewsJob()).toBeNull()
  })
})
