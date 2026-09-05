import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import sharp from 'sharp'

const mocks = vi.hoisted(() => ({
  findSession: vi.fn(),
  getSupabase: vi.fn(),
  loadState: vi.fn(),
  rotateSession: vi.fn(),
  setCookie: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/paperSession', () => ({
  findPaperSession: mocks.findSession,
  clearSessionCookie: vi.fn(),
  createSessionForPaper: vi.fn(),
  setSessionCookie: mocks.setCookie,
  generateToken: vi.fn(() => 'token'),
  hashToken: vi.fn((value: string) => `hash:${value}`),
  expiresIn: vi.fn(() => '2099-01-01T00:00:00.000Z'),
  RECOVERY_LINK_TTL_SECONDS: 900,
  rotateSessionForPaper: mocks.rotateSession,
}))
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: mocks.getSupabase,
  isSupabaseAdminConfigured: vi.fn(() => true),
}))
vi.mock('@/lib/paperState', () => ({
  loadPaperState: mocks.loadState,
  validatePaperStateInput: vi.fn((value) => value),
}))
vi.mock('@/lib/rateLimit', () => ({
  checkDraftCreationLimit: vi.fn(async () => ({ allowed: true, remaining: 1, enforced: true })),
  getClientIp: vi.fn(() => '192.0.2.1'),
  reserveUploadCapacity: vi.fn(async () => ({ allowed: true, remaining: 1, enforced: true })),
  UPLOAD_LIMITS: { maxRequestBytes: 10 * 1024 * 1024 + 64 * 1024 },
}))

function session() {
  return { id: 'session-id', paperId: '11111111-1111-4111-8111-111111111111', expiresAt: '2099-01-01T00:00:00.000Z' }
}

function chain(result: unknown = { data: null, error: null }) {
  const api: any = {
    select: vi.fn(() => api), insert: vi.fn(() => api), update: vi.fn(() => api), delete: vi.fn(() => api),
    eq: vi.fn(() => api), neq: vi.fn(() => api), is: vi.fn(() => api), gt: vi.fn(() => api), lt: vi.fn(() => api),
    in: vi.fn(() => api), order: vi.fn(() => api), limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => result), single: vi.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return api
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findSession.mockResolvedValue(session())
})

describe('paper ownership en hervatten', () => {
  it('weigert lezen zonder sessie', async () => {
    mocks.findSession.mockResolvedValue(null)
    const { GET } = await import('@/app/api/papers/route')
    const response = await GET(new NextRequest('https://example.test/api/papers'))
    expect(response.status).toBe(401)
  })

  it('negeert een aangeleverde andere paperId en schrijft alleen naar de sessiekrant', async () => {
    const papers = chain({ data: null, error: null })
    mocks.getSupabase.mockReturnValue({ from: vi.fn(() => papers) })
    const { PATCH } = await import('@/app/api/papers/route')
    const response = await PATCH(new NextRequest('https://example.test/api/papers', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paperId: '22222222-2222-4222-8222-222222222222', manualEdits: { nieuws: 'veilig' } }),
    }))
    expect(response.status).toBe(200)
    expect(papers.eq).toHaveBeenCalledWith('id', session().paperId)
    expect(papers.eq).not.toHaveBeenCalledWith('id', '22222222-2222-4222-8222-222222222222')
  })

  it('laadt na refresh de server-state uit de sessie', async () => {
    mocks.loadState.mockResolvedValue({ paperId: session().paperId, basisGegevens: { volledigeNaam: 'Ada' }, manualEdits: { nieuws: 'edit' } })
    const { GET } = await import('@/app/api/papers/route')
    const response = await GET(new NextRequest('https://example.test/api/papers'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { basisGegevens: { volledigeNaam: 'Ada' }, manualEdits: { nieuws: 'edit' } } })
  })
})

describe('private foto-ownership', () => {
  it('verwijdert de foto van een andere krant niet', async () => {
    const photos = chain({ data: null, error: null })
    const remove = vi.fn()
    mocks.getSupabase.mockReturnValue({ from: vi.fn(() => photos), storage: { from: vi.fn(() => ({ remove })) } })
    const { DELETE } = await import('@/app/api/photos/upload/route')
    const response = await DELETE(new NextRequest('https://example.test/api/photos/upload', {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: '22222222-2222-4222-8222-222222222222' }),
    }))
    expect(response.status).toBe(404)
    expect(photos.eq).toHaveBeenCalledWith('paper_id', session().paperId)
    expect(remove).not.toHaveBeenCalled()
  })

  it('koppelt upload altijd aan de sessiekrant, niet aan client-paperId', async () => {
    const rpc = vi.fn(async (_name: string, value: unknown) => ({ data: [{ photo_id: '33333333-3333-4333-8333-333333333333' }], error: null }))
    mocks.getSupabase.mockReturnValue({
      rpc,
      storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) })) },
    })
    const form = new FormData()
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer()
    form.set('file', new File([png], 'attack.png', { type: 'image/png' }))
    form.set('position', '1')
    form.set('paperId', '22222222-2222-4222-8222-222222222222')
    const { POST } = await import('@/app/api/photos/upload/route')
    const response = await POST(new NextRequest('https://example.test/api/photos/upload', {
      method: 'POST', body: form, headers: { 'content-length': String(png.length + 500) },
    }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('replace_paper_photo', expect.objectContaining({ target_paper_id: session().paperId }))
  })
})

describe('eenmalige herstellink', () => {
  it('weigert verlopen en reeds gebruikte links met dezelfde generieke redirect', async () => {
    mocks.getSupabase.mockReturnValue({ rpc: vi.fn(async () => ({ data: [], error: null })) })
    const { GET } = await import('@/app/api/session/recover/route')
    for (const token of ['expired-token-that-is-long-enough-1234567890', 'reused-token-that-is-long-enough-12345678901']) {
      const response = await GET(new NextRequest(`https://babykrantje.nl/api/session/recover?token=${token}`))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://babykrantje.nl/wizard?herstel=ongeldig')
    }
    expect(mocks.rotateSession).not.toHaveBeenCalled()
  })

  it('wisselt geldig token om en verwijdert het direct uit de zichtbare URL', async () => {
    mocks.getSupabase.mockReturnValue({ rpc: vi.fn(async () => ({ data: [{ paper_id: session().paperId }], error: null })) })
    mocks.rotateSession.mockResolvedValue({ token: 'new-session', session: session() })
    const { GET } = await import('@/app/api/session/recover/route')
    const response = await GET(new NextRequest('https://babykrantje.nl/api/session/recover?token=valid-token-that-is-long-enough-123456789012'))
    expect(response.headers.get('location')).toBe('https://babykrantje.nl/generate-articles')
    expect(response.headers.get('location')).not.toContain('token=')
    expect(mocks.setCookie).toHaveBeenCalledWith(response, 'new-session', session().expiresAt)
  })
})
