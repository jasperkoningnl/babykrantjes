import { NextRequest, NextResponse } from 'next/server'
import { hashToken, rotateSessionForPaper, setSessionCookie } from '@/lib/paperSession'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const cleanUrl = new URL('/generate-articles', request.url)
  const invalidUrl = new URL('/wizard?herstel=ongeldig', request.url)
  const token = request.nextUrl.searchParams.get('token') || ''
  if (token.length < 40 || token.length > 64) return NextResponse.redirect(invalidUrl)

  const { data, error } = await getSupabaseAdmin().rpc('consume_paper_recovery_link', { p_token_hash: hashToken(token) })
  const paperId = data?.[0]?.paper_id
  if (error || !paperId) return NextResponse.redirect(invalidUrl)

  const { token: sessionToken, session } = await rotateSessionForPaper(paperId)
  const response = NextResponse.redirect(cleanUrl)
  response.headers.set('Cache-Control', 'no-store')
  setSessionCookie(response, sessionToken, session.expiresAt)
  return response
}
