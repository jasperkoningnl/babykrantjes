import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('server-only', () => ({}))

describe('passwordloze gastensessie', () => {
  beforeEach(() => vi.resetModules())

  it('genereert 256 bits en bewaart alleen een SHA-256 representatie', async () => {
    const { generateToken, hashToken } = await import('@/lib/paperSession')
    const first = generateToken()
    const second = generateToken()
    expect(Buffer.from(first, 'base64url')).toHaveLength(32)
    expect(first).not.toBe(second)
    expect(hashToken(first)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(first)).not.toContain(first)
  })

  it('zet de sessie alleen in een veilige HttpOnly Lax cookie', async () => {
    const { setSessionCookie, PAPER_SESSION_COOKIE } = await import('@/lib/paperSession')
    const response = NextResponse.json({ ok: true })
    setSessionCookie(response, 'token', new Date(Date.now() + 60_000).toISOString())
    const header = response.headers.get('set-cookie') || ''
    expect(header).toContain(`${PAPER_SESSION_COOKIE}=token`)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Secure')
    expect(header).toContain('SameSite=lax')
  })
})

describe('invoer- en limitergrenzen', () => {
  it('escaped dynamische e-mailvelden', async () => {
    const { escapeHtml } = await import('@/lib/html')
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;')
  })

  it('klemt Wayback-testwaarden hard af', async () => {
    const { parseTestLimits, MAX_TEST_DATES, MAX_RUNS_PER_DATE } = await import('@/lib/waybackTestLimits')
    expect(parseTestLimits(new URLSearchParams('count=999999&runs=999999'))).toEqual({ count: MAX_TEST_DATES, runs: MAX_RUNS_PER_DATE })
    expect(parseTestLimits(new URLSearchParams('count=-2&runs=0'))).toEqual({ count: 1, runs: 1 })
  })

  it('faalt dicht wanneer Redis/rate limiting ontbreekt', async () => {
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const { checkRateLimit } = await import('@/lib/rateLimit')
    await expect(checkRateLimit(new Request('https://example.test'), 'paper')).resolves.toMatchObject({ allowed: false, unavailable: true })
  })
})
