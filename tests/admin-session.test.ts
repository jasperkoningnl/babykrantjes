import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({ verify: vi.fn(), refresh: vi.fn(), user: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { verifyOtp: mock.verify, refreshSession: mock.refresh, getUser: mock.user } }) }))
import { POST, PUT, DELETE } from '@/app/api/admin/session/route'
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE } from '@/lib/adminAuth'

const nonce = 'test-browser-nonce'
function request(state: string, cookie = nonce) {
  return new NextRequest('https://example.test/api/admin/session', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: `__Host-babykrant_admin_login=${cookie}` },
    body: new URLSearchParams({ state, token_hash: 'supabase-one-time-token' }),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_EMAILS = 'editor@example.test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test'
  mock.verify.mockResolvedValue({ data: { user: { email: 'editor@example.test', email_confirmed_at: 'now' }, session: { access_token: 'verified-token', refresh_token: 'refresh-secret', expires_at: Math.floor(Date.now()/1000)+3600 } }, error: null })
  mock.user.mockResolvedValue({ data: { user: { id: 'editor', email: 'editor@example.test', email_confirmed_at: 'now' } }, error: null })
  mock.refresh.mockResolvedValue({ data: { session: { access_token: 'new-access', refresh_token: 'rotated-secret', expires_at: Math.floor(Date.now()/1000)+3600 } }, error: null })
})
describe('one-time editor login', () => {
  it.each(['null', 'https://other.test', ''])('rejects untrusted origin %s even with a valid browser nonce', async origin => {
    const req = request(createHash('sha256').update(nonce).digest('hex'))
    if (origin) req.headers.set('origin', origin)
    else req.headers.delete('origin')
    const response = await POST(req)
    expect(response.status).toBe(403)
    expect(mock.verify).not.toHaveBeenCalled()
  })
  it('rejects an email link opened outside the requesting browser', async () => {
    const response = await POST(request('a'.repeat(64)))
    expect(response.headers.get('location')).toContain('/admin/login?expired=1')
    expect(mock.verify).not.toHaveBeenCalled()
  })
  it('sets secure HttpOnly access and persistent refresh cookies after verification', async () => {
    const response = await POST(request(createHash('sha256').update(nonce).digest('hex')))
    expect(response.headers.get('location')).toBe('https://example.test/admin')
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('__Host-babykrant_admin=verified-token')
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=lax')
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)?.value).toBe('refresh-secret')
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)?.maxAge).toBe(365 * 86400)
  })
  it('refuses a valid link if the address is no longer allowed', async () => {
    process.env.ADMIN_EMAILS = ''
    const response = await POST(request(createHash('sha256').update(nonce).digest('hex')))
    expect(response.headers.get('location')).toContain('/admin/login')
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

function renewal(cookie = `${ADMIN_REFRESH_COOKIE}=old-secret`, origin = 'https://example.test') {
  return new NextRequest('https://example.test/api/admin/session', { method: 'PUT', headers: { origin, cookie } })
}
describe('remembered editor browser', () => {
  it('restores expired access and rotates the remembered cookie without exposing tokens in JSON', async () => {
    const response = await PUT(renewal())
    expect(response.status).toBe(200)
    expect(mock.refresh).toHaveBeenCalledWith({ refresh_token: 'old-secret' })
    expect(mock.user).toHaveBeenCalledWith('new-access')
    expect(response.cookies.get(ADMIN_COOKIE)?.value).toBe('new-access')
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)?.value).toBe('rotated-secret')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ ok: true })
  })
  it('does not rotate again when another tab already renewed access', async () => {
    expect((await PUT(renewal(`${ADMIN_COOKIE}=valid; ${ADMIN_REFRESH_COOKIE}=old-secret`))).status).toBe(200)
    expect(mock.refresh).not.toHaveBeenCalled()
  })
  it('rejects missing credentials and foreign-origin renewal', async () => {
    expect((await PUT(renewal(''))).status).toBe(401)
    expect((await PUT(renewal(undefined, 'https://other.test'))).status).toBe(403)
    expect(mock.refresh).not.toHaveBeenCalled()
  })
  it('rechecks access permissions after refresh', async () => {
    process.env.ADMIN_EMAILS = ''
    const response = await PUT(renewal())
    expect(response.status).toBe(401)
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)?.maxAge).toBe(0)
  })
  it('does not discard remembered credentials during a temporary outage', async () => {
    mock.refresh.mockResolvedValue({ data: {}, error: { status: 503 } })
    const response = await PUT(renewal())
    expect(response.status).toBe(503)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('removes both cookies on explicit logout', async () => {
    const response = await DELETE(renewal())
    expect(response.cookies.get(ADMIN_COOKIE)?.maxAge).toBe(0)
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)?.maxAge).toBe(0)
  })
})
