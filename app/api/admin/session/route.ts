import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminAuthClient, isAdminEmail, sameOrigin } from '@/lib/adminAuth'

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  try {
    const form = await request.formData()
    const token = String(form.get('token_hash') || '')
    const state = String(form.get('state') || '')
    const nonce = request.cookies.get('__Host-babykrant_admin_login')?.value
    if (!nonce || !/^[a-f0-9]{64}$/.test(state) || token.length > 512 || !token) throw new Error('Invalid link')
    const expected = createHash('sha256').update(nonce).digest()
    if (!timingSafeEqual(expected, Buffer.from(state, 'hex'))) throw new Error('Invalid state')
    const { data, error } = await adminAuthClient().auth.verifyOtp({ token_hash: token, type: 'email' })
    if (error || !data.session || !data.user?.email_confirmed_at || !isAdminEmail(data.user.email)) throw new Error('Not allowed')
    const response = NextResponse.redirect(new URL('/admin', request.url), 303)
    response.cookies.set(ADMIN_COOKIE, data.session.access_token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
      maxAge: Math.max(0, Math.min(3600, (data.session.expires_at || 0) - Math.floor(Date.now() / 1000))),
    })
    response.cookies.set('__Host-babykrant_admin_login', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.redirect(new URL('/admin/login?expired=1', request.url), 303)
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
