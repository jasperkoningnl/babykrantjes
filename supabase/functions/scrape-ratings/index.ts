// supabase/functions/scrape-ratings/index.ts
// Job 2: Kijkcijfers (dagelijks, 10:00)
// Bron: kijkonderzoek.nl — top van gisteren
// Schrijft naar: daily_ratings
//
// Optionele query parameters:
//   ?date=YYYY-MM-DD  — datum om te scrapen (default gisteren);
//                       kijkonderzoek.nl heeft data tot ~7 dagen terug

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry } from '../_shared/fetch.ts'
import { todayISO, yesterdayISO } from '../_shared/dates.ts'
import { parseKijkcijfers, extractPageDate } from '../_shared/parsers/kijkcijfers.ts'

const SOURCE_NAME = 'kijkonderzoek-nl'
const MAX_RANK = 20

function calculateDaysAgo(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const [ty, tm, td] = todayISO().split('-').map(Number)
  const today = Date.UTC(ty, tm - 1, td)
  return Math.round((today - target) / 86400000)
}

async function scrape(supabase: SupabaseClient, date: string): Promise<{ inserted: number; details: unknown }> {
  const daysAgo = calculateDaysAgo(date)
  if (daysAgo < 0 || daysAgo > 7) {
    throw new Error(`Datum ${date} valt buiten het bereik van kijkonderzoek.nl (0-7 dagen geleden)`)
  }

  const url = `https://kijkonderzoek.nl/component/kijkcijfers/file,d1-${daysAgo}-0-p`
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`kijkonderzoek.nl gaf HTTP ${response.status}`)
  }

  const html = await response.text()

  const pageDate = extractPageDate(html)
  if (pageDate && pageDate !== date) {
    throw new Error(`Datum-mismatch: pagina toont ${pageDate}, verwacht ${date} — data nog niet beschikbaar`)
  }

  const ratings = parseKijkcijfers(html, MAX_RANK)
  if (ratings.length === 0) {
    throw new Error('0 kijkcijfer-rijen geparseerd — HTML-structuur mogelijk gewijzigd')
  }

  const rows = ratings.map((r) => ({
    date,
    rank: r.rank,
    program_name: r.programName,
    channel: r.channel,
    viewers: r.viewers,
    market_share: null,
    source: 'kijkonderzoek.nl',
  }))

  const { error } = await supabase
    .from('daily_ratings')
    .upsert(rows, { onConflict: 'date,rank' })

  if (error) throw new Error(`Database: ${error.message}`)

  return { inserted: rows.length, details: { date, url } }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || yesterdayISO()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: 'Ongeldige datum, gebruik YYYY-MM-DD' }, { status: 400 })
  }

  return runJob(SOURCE_NAME, (supabase) => scrape(supabase, date))
})
