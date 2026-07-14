// supabase/functions/scrape-music/index.ts
// Job 5: Top 40 (wekelijks, maandag 12:00)
// Bron: top40.nl — de actuele Top 40
// Schrijft naar: weekly_music
//
// De TLS-problemen die de Next.js route had met top40.nl (onvolledige
// certificaatketen onder Node) spelen in de Deno Edge Runtime niet:
// hier volstaat gewone fetch met certificaatverificatie AAN.

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry, BROWSER_HEADERS } from '../_shared/fetch.ts'
import { todayISO, mondayOfWeek } from '../_shared/dates.ts'
import { parseTop40 } from '../_shared/parsers/top40.ts'

const SOURCE_NAME = 'top40-nl'

async function scrape(supabase: SupabaseClient): Promise<{ inserted: number; details: unknown }> {
  const url = 'https://www.top40.nl/top40'
  const response = await fetchWithRetry(url, { headers: BROWSER_HEADERS })

  if (!response.ok) {
    throw new Error(`top40.nl gaf HTTP ${response.status}`)
  }

  const html = await response.text()
  const entries = parseTop40(html)

  if (entries.length === 0) {
    throw new Error('0 chart-entries geparseerd — HTML-structuur mogelijk gewijzigd')
  }

  const weekStart = mondayOfWeek(todayISO())
  const rows = entries.map((e) => ({
    week_start: weekStart,
    rank: e.rank,
    title: e.title,
    artist: e.artist,
    source: 'top40.nl',
  }))

  const { error } = await supabase
    .from('weekly_music')
    .upsert(rows, { onConflict: 'week_start,rank' })

  if (error) throw new Error(`Database: ${error.message}`)

  return { inserted: rows.length, details: { weekStart, url } }
}

Deno.serve(async (_req: Request) => {
  return runJob(SOURCE_NAME, (supabase) => scrape(supabase))
})
