import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({ verify: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { verifyOtp: mock.verify } }) }))
import { POST } from '@/app/api/admin/session/route'

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
  mock.verify.mockResolvedValue({ data: { user: { email: 'editor@example.test', email_confirmed_at: 'now' }, session: { access_token: 'verified-token', expires_at: Math.floor(Date.now()/1000)+3600 } }, error: null })
})
describe('one-time editor login', () => {
  it('rejects an email link opened outside the requesting browser', async () => {
    const response = await POST(request('a'.repeat(64)))
    expect(response.headers.get('location')).toContain('/admin/login?expired=1')
    expect(mock.verify).not.toHaveBeenCalled()
  })
  it('sets only a secure HttpOnly access cookie after verification', async () => {
    const response = await POST(request(createHash('sha256').update(nonce).digest('hex')))
    expect(response.headers.get('location')).toBe('https://example.test/admin')
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('__Host-babykrant_admin=verified-token')
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=lax')
    expect(cookie).not.toContain('refresh_token')
  })
  it('refuses a valid link if the address is no longer allowed', async () => {
    process.env.ADMIN_EMAILS = ''
    const response = await POST(request(createHash('sha256').update(nonce).digest('hex')))
    expect(response.headers.get('location')).toContain('/admin/login')
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
