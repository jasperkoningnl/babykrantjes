import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from './supabase'

export const PAPER_SESSION_COOKIE = '__Host-babykrant_session'
export const PAPER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
export const RECOVERY_LINK_TTL_SECONDS = 60 * 15

export interface PaperSession {
  id: string
  paperId: string
  expiresAt: string
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function expiresIn(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string): void {
  response.cookies.set({
    name: PAPER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
    priority: 'high',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: PAPER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function findPaperSession(
  request: NextRequest,
  expectedPaperId?: string | null
): Promise<PaperSession | null> {
  const token = request.cookies.get(PAPER_SESSION_COOKIE)?.value
  if (!token || token.length < 40 || token.length > 64) return null

  const now = new Date().toISOString()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('paper_guest_sessions')
    .select('id, paper_id, expires_at')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  if (error || !data || (expectedPaperId && data.paper_id !== expectedPaperId)) return null

  const { data: paper } = await supabase
    .from('generated_papers')
    .select('id')
    .eq('id', data.paper_id)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle()
  if (!paper) return null

  await Promise.all([
    supabase.from('paper_guest_sessions').update({ last_seen_at: now }).eq('id', data.id),
    supabase.from('generated_papers').update({ last_activity_at: now }).eq('id', data.paper_id),
  ])

  return { id: data.id, paperId: data.paper_id, expiresAt: data.expires_at }
}

export async function createSessionForPaper(paperId: string): Promise<{ token: string; session: PaperSession }> {
  const token = generateToken()
  const expiresAt = expiresIn(PAPER_SESSION_TTL_SECONDS)
  const { data, error } = await getSupabaseAdmin()
    .from('paper_guest_sessions')
    .insert({ paper_id: paperId, token_hash: hashToken(token), expires_at: expiresAt })
    .select('id, paper_id, expires_at')
    .single()

  if (error || !data) throw new Error(`Sessietoken kon niet worden opgeslagen: ${error?.message || 'onbekend'}`)
  return { token, session: { id: data.id, paperId: data.paper_id, expiresAt: data.expires_at } }
}

export async function rotateSessionForPaper(paperId: string): Promise<{ token: string; session: PaperSession }> {
  const supabase = getSupabaseAdmin()
  const created = await createSessionForPaper(paperId)
  await supabase
    .from('paper_guest_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('paper_id', paperId)
    .neq('id', created.session.id)
    .is('revoked_at', null)
  return created
}
