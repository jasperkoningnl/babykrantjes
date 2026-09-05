import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomBytes, createHash } from 'node:crypto'
import { isAdminEmail, sameOrigin } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checkEmailRateLimit } from '@/lib/rateLimit'
import { escapeHtml } from '@/lib/html'

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  try {
    const { email: input } = await request.json()
    const email = typeof input === 'string' ? input.trim().toLowerCase() : ''
    if (!email || email.length > 254) return NextResponse.json({ error: 'Vul een geldig e-mailadres in' }, { status: 400 })
    const limit = await checkEmailRateLimit(request, 'admin-login', email)
    if (!limit.allowed) return NextResponse.json({ error: 'Probeer het later opnieuw' }, { status: limit.unavailable ? 503 : 429 })
    const generic = NextResponse.json({ ok: true, message: 'Als dit adres toegang heeft, ontvang je een inloglink.' })
    if (!isAdminEmail(email)) return generic
    const base = new URL(process.env.NEXT_PUBLIC_SITE_URL || '')
    if (base.protocol !== 'https:' || !process.env.RESEND_API_KEY) throw new Error('Missing configuration')
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({ type: 'magiclink', email })
    if (error || !data.properties?.hashed_token) throw new Error('Link unavailable')
    // Bind the link to the requesting browser, preventing login CSRF.
    const nonce = randomBytes(32).toString('base64url')
    const link = new URL('/admin/confirm', base)
    link.searchParams.set('token_hash', data.properties.hashed_token)
    link.searchParams.set('state', createHash('sha256').update(nonce).digest('hex'))
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Babykrantje <noreply@babykrantje.nl>', to: email, subject: 'Inloggen bij Babykrantje redactie',
      html: `<p>Open deze eenmalige link in dezelfde browser waarin je hem hebt aangevraagd.</p><p><a href="${escapeHtml(link.toString())}">Naar de redactie</a></p><p>Niet aangevraagd? Negeer deze e-mail.</p>`,
    })
    if (result.error || !result.data?.id) throw new Error('Mail unavailable')
    generic.cookies.set('__Host-babykrant_admin_login', nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 900 })
    return generic
  } catch {
    return NextResponse.json({ error: 'Inloggen is tijdelijk niet beschikbaar' }, { status: 503 })
  }
}
