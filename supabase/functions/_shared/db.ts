// supabase/functions/_shared/db.ts
// Supabase admin client en job-administratie voor de scrape-functies.
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden door Supabase automatisch
// in de Edge Function runtime geïnjecteerd.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type { SupabaseClient }

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt in de Edge Function omgeving')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export type RunStatus = 'success' | 'error' | 'partial'

/**
 * Werkt de administratie in scrape_sources bij na een run.
 * Zoekt op naam; als de bron (nog) niet bestaat is dit een no-op.
 */
export async function reportRun(
  supabase: SupabaseClient,
  sourceName: string,
  status: RunStatus,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('scrape_sources')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_error: errorMessage ?? null,
    })
    .eq('name', sourceName)

  if (error) {
    console.error(`[reportRun] Kon scrape_sources niet bijwerken voor ${sourceName}:`, error.message)
  }
}

/**
 * Standaard afhandeling voor een scrape-job:
 * - voert de job uit
 * - werkt scrape_sources bij
 * - geeft een nette JSON-response terug
 */
export async function runJob(
  sourceName: string,
  job: (supabase: SupabaseClient) => Promise<{ inserted: number; details?: unknown }>
): Promise<Response> {
  const supabase = adminClient()
  try {
    const result = await job(supabase)
    const status: RunStatus = result.inserted > 0 ? 'success' : 'partial'
    await reportRun(supabase, sourceName, status, result.inserted > 0 ? undefined : 'Geen rijen geschreven')
    return Response.json({ ok: true, source: sourceName, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${sourceName}] Fout:`, message)
    await reportRun(supabase, sourceName, 'error', message)
    return Response.json({ ok: false, source: sourceName, error: message }, { status: 500 })
  }
}
