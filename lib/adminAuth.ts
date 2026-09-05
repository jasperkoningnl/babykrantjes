import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export const ADMIN_COOKIE = '__Host-babykrant_admin'

export function isAdminEmail(email: string | undefined): boolean {
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  return Boolean(email && allowed.includes(email.trim().toLowerCase()))
}

/** A fresh auth client per request: never persist an editor's session on the shared admin client. */
export function adminAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Beheer is nog niet ingesteld')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export async function getAdminIdentity(token?: string) {
  if (!token || token.length > 8192) return null
  try {
    const { data, error } = await adminAuthClient().auth.getUser(token)
    const user = data.user
    if (error || !user?.email_confirmed_at || !isAdminEmail(user.email)) return null
    return { id: user.id, email: user.email! }
  } catch { return null }
}

export function sameOrigin(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin
}

export async function requireAdmin(request: NextRequest) {
  return getAdminIdentity(request.cookies.get(ADMIN_COOKIE)?.value)
}
