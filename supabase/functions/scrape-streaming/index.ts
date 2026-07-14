// supabase/functions/scrape-streaming/index.ts
// Job 3: Streaming top 10 (dagelijks, 08:00)
// Bron: flixpatrol.com — gecombineerde streaming top 10 NL
// Schrijft naar: daily_streaming
//
// Optionele query parameters:
//   ?date=YYYY-MM-DD  — datum om te scrapen (default gisteren)

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry, BROWSER_HEADERS } from '../_shared/fetch.ts'
import { yesterdayISO } from '../_shared/dates.ts'
import { parseFlixPatrol } from '../_shared/parsers/flixpatrol.ts'

const SOURCE_NAME = 'flixpatrol'

async function scrape(supabase: SupabaseClient, date: string): Promise<{ inserted: number; details: unknown }> {
  const url = `https://flixpatrol.com/top10/streaming/netherlands/${date}/`
  const response = await fetchWithRetry(url, { headers: BROWSER_HEADERS })

  if (!response.ok) {
    throw new Error(`flixpatrol.com gaf HTTP ${response.status} voor ${url}`)
  }

  const html = await response.text()
  const parsed = parseFlixPatrol(html)

  if (parsed.length === 0) {
    throw new Error('0 streaming-entries geparseerd — HTML-structuur mogelijk gewijzigd')
  }

  // Dedupliceer op de volledige unieke sleutel (platform, rang, type),
  // anders weigert Postgres de upsert bij dubbele conflict-keys.
  const seen = new Set<string>()
  const entries = parsed.filter((e) => {
    const key = `${e.platform}:${e.rank}:${e.contentType ?? 'onbekend'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const rows = entries.map((e) => ({
    date,
    rank: e.rank,
    title: e.title,
    platform: e.platform,
    content_type: e.contentType ?? 'onbekend',
    source: 'flixpatrol.com',
  }))

  const { error } = await supabase
    .from('daily_streaming')
    .upsert(rows, { onConflict: 'date,rank,platform,content_type' })

  if (error) throw new Error(`Database: ${error.message}`)

  return { inserted: rows.length, details: { date, url, platforms: [...new Set(rows.map((r) => r.platform))] } }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || yesterdayISO()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: 'Ongeldige datum, gebruik YYYY-MM-DD' }, { status: 400 })
  }

  return runJob(SOURCE_NAME, (supabase) => scrape(supabase, date))
})
