import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { findPaperSession, generateToken, hashToken, expiresIn, RECOVERY_LINK_TTL_SECONDS } from '@/lib/paperSession'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checkEmailRateLimit } from '@/lib/rateLimit'
import { escapeHtml } from '@/lib/html'

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: paper, error: paperError } = await supabase.from('generated_papers').select('baby_name, contact_email').eq('id', session.paperId).maybeSingle()
  if (paperError) {
    console.error('[SendEmail] Krant ophalen mislukt:', paperError.message)
    return NextResponse.json({ error: 'E-mail kon niet worden verstuurd' }, { status: 503 })
  }
  const email = String(paper?.contact_email || '').trim().toLowerCase()
  const generic = { accepted: true, message: 'Als het adres beschikbaar is, wordt de link verstuurd.' }
  if (!email) return NextResponse.json(generic, { status: 202 })

  const limit = await checkEmailRateLimit(request, session.paperId, email)
  if (!limit.allowed) return NextResponse.json({ error: 'Verzoek tijdelijk niet beschikbaar' }, { status: limit.unavailable ? 503 : 429 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Verzoek tijdelijk niet beschikbaar' }, { status: 503 })

  const token = generateToken()
  const expiresAt = expiresIn(RECOVERY_LINK_TTL_SECONDS)
  const now = new Date().toISOString()
  await supabase.from('paper_recovery_links').update({ revoked_at: now }).eq('paper_id', session.paperId).is('used_at', null).is('revoked_at', null)
  const { error: linkError } = await supabase.from('paper_recovery_links').insert({
    paper_id: session.paperId,
    token_hash: hashToken(token),
    email,
    expires_at: expiresAt,
  })
  if (linkError) return NextResponse.json({ error: 'Verzoek tijdelijk niet beschikbaar' }, { status: 503 })

  const base = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://babykrantje.nl')
  const recoveryUrl = new URL('/api/session/recover', base)
  recoveryUrl.searchParams.set('token', token)
  const subjectName = String(paper?.baby_name || 'je kleintje').replace(/[\r\n]+/g, ' ').slice(0, 80)
  const naam = escapeHtml(subjectName)
  const safeUrl = escapeHtml(recoveryUrl.toString())

  try {
    const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Babykrantje <noreply@babykrantje.nl>',
      to: email,
      subject: `Je link naar het babykrantje van ${subjectName}`,
      html: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#23231F"><h1 style="font-family:system-ui,sans-serif;font-size:26px">Het babykrantje van ${naam}</h1><p style="font-size:16px;line-height:1.6">Gebruik de eenmalige link hieronder. De link verloopt binnen 15 minuten.</p><p><a href="${safeUrl}" style="display:inline-block;background:#8FA88A;color:#FDF8F0;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700">Open mijn babykrantje</a></p><p style="font-size:13px;color:#7A756C">Heb je dit niet aangevraagd, dan kun je deze e-mail negeren.</p></div>`,
    })
    if (error || !data?.id) {
      console.error('[SendEmail] Resend fout:', error || 'Geen bericht-id ontvangen')
      await supabase.from('paper_recovery_links').update({ revoked_at: new Date().toISOString() }).eq('token_hash', hashToken(token)).is('used_at', null)
      return NextResponse.json({ error: 'E-mail kon niet worden verstuurd. Probeer het opnieuw.' }, { status: 503 })
    }
  } catch (error) {
    console.error('[SendEmail] Provider fout:', error)
    await supabase.from('paper_recovery_links').update({ revoked_at: new Date().toISOString() }).eq('token_hash', hashToken(token)).is('used_at', null)
    return NextResponse.json({ error: 'E-mail kon niet worden verstuurd. Probeer het opnieuw.' }, { status: 503 })
  }
  return NextResponse.json(generic, { status: 202 })
}
