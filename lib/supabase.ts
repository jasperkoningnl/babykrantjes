// lib/supabase.ts
// @version 1.0.0
// Twee Supabase clients:
// - getSupabasePublic(): anon key, veilig voor client-side (reads onder RLS)
// - getSupabaseAdmin(): service role key, ALLEEN server-side (schrijfoperaties)
//
// Environment variables (in Vercel):
// - NEXT_PUBLIC_SUPABASE_URL       project URL (https://xxxxx.supabase.co)
// - NEXT_PUBLIC_SUPABASE_ANON_KEY  publishable/anon key
// - SUPABASE_SERVICE_ROLE_KEY      service role key (géén NEXT_PUBLIC_ prefix,
//                                  mag nooit in de browser terechtkomen)

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let publicClient: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

/**
 * Is Supabase geconfigureerd in deze omgeving?
 * Routes gebruiken dit om de cache-laag gracieus over te slaan zolang de
 * env vars nog niet gezet zijn (bijv. preview deploys).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Is de admin client (service role) beschikbaar? Alleen server-side.
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Public client met anon key. Veilig voor client-side gebruik;
 * reads vallen onder Row Level Security.
 */
export function getSupabasePublic(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is niet geconfigureerd: NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreken'
    )
  }
  if (!publicClient) {
    publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return publicClient
}

/**
 * Admin client met service role key. Omzeilt RLS — uitsluitend gebruiken
 * in API routes en server-side code, nooit in componenten die naar de
 * browser gaan.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin() mag alleen server-side aangeroepen worden')
  }
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      'Supabase admin is niet geconfigureerd: NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken'
    )
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return adminClient
}
