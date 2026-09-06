import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, adminAuthClient, isAdminEmail, sameOrigin, getAdminIdentity, setAdminSession, clearAdminSession } from '@/lib/adminAuth'

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
    setAdminSession(response, data.session)
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
  clearAdminSession(response)
  return response
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  // A second browser tab may already have renewed the cookies while this one waited.
  if (await getAdminIdentity(request.cookies.get(ADMIN_COOKIE)?.value)) return response
  const refresh = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value
  if (!refresh || refresh.length > 8192) return NextResponse.json({ error: 'Log opnieuw in' }, { status: 401 })
  try {
    const { data, error } = await adminAuthClient().auth.refreshSession({ refresh_token: refresh })
    if (error) return NextResponse.json({ error: 'Je sessie kon niet worden hersteld. Probeer het opnieuw.' }, { status: error.status === 400 || error.status === 401 || error.status === 403 ? 401 : 503 })
    if (!data.session || !await getAdminIdentity(data.session.access_token)) {
      const denied = NextResponse.json({ error: 'Log opnieuw in' }, { status: 401 })
      clearAdminSession(denied)
      return denied
    }
    setAdminSession(response, data.session)
    return response
  } catch {
    return NextResponse.json({ error: 'Inloggen is tijdelijk niet beschikbaar. Probeer het opnieuw.' }, { status: 503 })
  }
}
