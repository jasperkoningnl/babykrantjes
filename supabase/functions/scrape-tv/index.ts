// supabase/functions/scrape-tv/index.ts
// Job 1: TV-programmering primetime (dagelijks, 06:00)
// Bron: tvgids.nl — gids van gisteren per zender
// Schrijft naar: daily_tv
//
// Optionele query parameters:
//   ?date=YYYY-MM-DD  — datum om te scrapen (default gisteren);
//                       tvgids.nl ondersteunt datums in de URL

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry, sleep, BROWSER_HEADERS } from '../_shared/fetch.ts'
import { yesterdayISO } from '../_shared/dates.ts'
import { parseTvGidsPage } from '../_shared/parsers/tvgids.ts'

const SOURCE_NAME = 'tvgids-nl'

// Zender-slugs zoals tvgids.nl ze in URL's gebruikt
const CHANNELS: Array<{ name: string; slug: string }> = [
  { name: 'NPO 1', slug: 'npo-1' },
  { name: 'NPO 2', slug: 'npo-2' },
  { name: 'NPO 3', slug: 'npo-3' },
  { name: 'RTL 4', slug: 'rtl-4' },
  { name: 'RTL 5', slug: 'rtl-5' },
  { name: 'RTL 7', slug: 'rtl-7' },
  { name: 'RTL 8', slug: 'rtl-8' },
  { name: 'SBS6', slug: 'sbs6' },
  { name: 'Net5', slug: 'net5' },
  { name: 'Veronica', slug: 'veronica' },
]

// Primetime venster
const PRIMETIME_FROM = '19:00'
const PRIMETIME_TO = '23:00'

function inPrimetime(timeSlot: string): boolean {
  return timeSlot >= PRIMETIME_FROM && timeSlot <= PRIMETIME_TO
}

async function scrape(supabase: SupabaseClient, date: string): Promise<{ inserted: number; details: unknown }> {
  let inserted = 0
  const perChannel: Record<string, number> = {}
  const errors: string[] = []

  for (const channel of CHANNELS) {
    try {
      const url = `https://www.tvgids.nl/gids/${date}/${channel.slug}`
      const response = await fetchWithRetry(url, { headers: BROWSER_HEADERS })

      if (!response.ok) {
        errors.push(`${channel.name}: HTTP ${response.status}`)
        continue
      }

      const html = await response.text()
      const programs = parseTvGidsPage(html).filter((p) => inPrimetime(p.timeSlot))
      perChannel[channel.name] = programs.length

      if (programs.length === 0) {
        errors.push(`${channel.name}: 0 primetime-programma's geparseerd`)
        continue
      }

      // Dedupliceer op tijdslot (unique constraint date+channel+time_slot)
      const seen = new Set<string>()
      const rows = programs
        .filter((p) => {
          if (seen.has(p.timeSlot)) return false
          seen.add(p.timeSlot)
          return true
        })
        .map((p) => ({
          date,
          channel: channel.name,
          time_slot: p.timeSlot,
          program_name: p.name,
          genre: p.genre,
          description: p.description,
          source: 'tvgids.nl',
        }))

      const { error } = await supabase
        .from('daily_tv')
        .upsert(rows, { onConflict: 'date,channel,time_slot' })

      if (error) {
        errors.push(`${channel.name}: ${error.message}`)
      } else {
        inserted += rows.length
      }
    } catch (err) {
      errors.push(`${channel.name}: ${err instanceof Error ? err.message : String(err)}`)
    }

    await sleep(2000)
  }

  if (inserted === 0) {
    throw new Error(`Geen enkele zender opgeslagen: ${errors.join('; ')}`)
  }

  return { inserted, details: { date, perChannel, errors } }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || yesterdayISO()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: 'Ongeldige datum, gebruik YYYY-MM-DD' }, { status: 400 })
  }

  return runJob(SOURCE_NAME, (supabase) => scrape(supabase, date))
})
