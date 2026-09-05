import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildContentSecurityPolicy, buildSecurityHeaders } = require('../security-headers')
const nextConfig = require('../next.config')

describe('security headers', () => {
  it('applies the required headers to every route', async () => {
    const rules = await nextConfig.headers()
    expect(rules).toHaveLength(1)
    expect(rules[0].source).toBe('/(.*)')
    expect(Object.fromEntries(rules[0].headers.map(({ key, value }: { key: string, value: string }) => [key, value])))
      .toMatchObject({
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      })
  })

  it('keeps required application resources and frame protection in the CSP', () => {
    const csp = buildContentSecurityPolicy({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co/rest/v1',
      PAYMENT_PROVIDER_ORIGIN: 'https://payments.example.test/checkout',
    })
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com")
    expect(csp).toContain("img-src 'self' data: https://image.tmdb.org https://project-ref.supabase.co")
    expect(csp).toContain("connect-src 'self' https://project-ref.supabase.co https://payments.example.test")
    expect(csp).toContain('frame-src https://payments.example.test')
    expect(csp).not.toContain('*')
  })

  it('does not allow a payment provider until one is configured', () => {
    expect(buildContentSecurityPolicy({})).toContain("frame-src 'none'")
    const headers = Object.fromEntries(buildSecurityHeaders({}).map(({ key, value }: { key: string, value: string }) => [key, value]))
    expect(headers['Permissions-Policy']).toContain('payment=()')
  })

  it('limits the Payment Request API to self and the configured provider', () => {
    const headers = Object.fromEntries(buildSecurityHeaders({ PAYMENT_PROVIDER_ORIGIN: 'https://pay.example.test/path' })
      .map(({ key, value }: { key: string, value: string }) => [key, value]))
    expect(headers['Permissions-Policy']).toContain('payment=(self "https://pay.example.test")')
  })

  it('rejects insecure or wildcard-like configured origins', () => {
    expect(() => buildSecurityHeaders({ NEXT_PUBLIC_SUPABASE_URL: 'http://project.supabase.co' }))
      .toThrow(/HTTPS-origin/)
    expect(() => buildSecurityHeaders({ PAYMENT_PROVIDER_ORIGIN: 'https://*.example.com' }))
      .toThrow(/geldige absolute URL/)
  })
})
