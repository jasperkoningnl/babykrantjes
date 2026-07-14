// supabase/functions/scrape-dossiers/index.ts
// Job 6: Nieuwsdossiers (wekelijks, zondag 03:00)
// Bronnen: VRT NWS dossiers, Al Jazeera sitemap (tag-sectie)
// Schrijft naar: news_dossiers
//
// Werkwijze per bron:
// - parse alle dossier-/tagnamen
// - bestaande dossiers: last_seen_at → vandaag, active → true
// - nieuwe dossiers: insert met first_seen_at = last_seen_at = vandaag
// - dossiers die niet meer voorkomen: active → false

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry, sleep, BROWSER_HEADERS } from '../_shared/fetch.ts'
import { todayISO } from '../_shared/dates.ts'
import { parseVrtDossiers, parseAlJazeeraTags, type ScrapedDossier } from '../_shared/parsers/dossiers.ts'

const SOURCE_NAME = 'news-dossiers'

const SCRAPERS: Array<{
  source: string
  url: string
  parse: (html: string) => ScrapedDossier[]
}> = [
  { source: 'vrt', url: 'https://www.vrt.be/vrtnws/nl/dossiers/', parse: parseVrtDossiers },
  { source: 'aljazeera', url: 'https://www.aljazeera.com/sitemap', parse: parseAlJazeeraTags },
]

async function syncSource(
  supabase: SupabaseClient,
  source: string,
  scraped: ScrapedDossier[]
): Promise<{ added: number; refreshed: number; deactivated: number }> {
  const today = todayISO()

  const { data: existing, error: fetchError } = await supabase
    .from('news_dossiers')
    .select('id, name, active')
    .eq('source', source)

  if (fetchError) throw new Error(`Database (select ${source}): ${fetchError.message}`)

  const existingByName = new Map((existing ?? []).map((d) => [d.name.toLowerCase(), d]))
  const scrapedNames = new Set(scraped.map((d) => d.name.toLowerCase()))

  // Nieuwe en bestaande dossiers
  let added = 0
  let refreshed = 0

  const toInsert = scraped
    .filter((d) => !existingByName.has(d.name.toLowerCase()))
    .map((d) => ({
      name: d.name,
      source: d.source,
      source_url: d.sourceUrl,
      first_seen_at: today,
      last_seen_at: today,
      active: true,
    }))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('news_dossiers').insert(toInsert)
    if (error) throw new Error(`Database (insert ${source}): ${error.message}`)
    added = toInsert.length
  }

  const refreshIds = (existing ?? [])
    .filter((d) => scrapedNames.has(d.name.toLowerCase()))
    .map((d) => d.id)

  if (refreshIds.length > 0) {
    const { error } = await supabase
      .from('news_dossiers')
      .update({ last_seen_at: today, active: true })
      .in('id', refreshIds)
    if (error) throw new Error(`Database (refresh ${source}): ${error.message}`)
    refreshed = refreshIds.length
  }

  // Verdwenen dossiers deactiveren (last_seen_at blijft de laatste waarneming)
  const disappearedIds = (existing ?? [])
    .filter((d) => d.active && !scrapedNames.has(d.name.toLowerCase()))
    .map((d) => d.id)

  if (disappearedIds.length > 0) {
    const { error } = await supabase
      .from('news_dossiers')
      .update({ active: false })
      .in('id', disappearedIds)
    if (error) throw new Error(`Database (deactivate ${source}): ${error.message}`)
  }

  return { added, refreshed, deactivated: disappearedIds.length }
}

async function scrape(supabase: SupabaseClient): Promise<{ inserted: number; details: unknown }> {
  const perSource: Record<string, unknown> = {}
  const errors: string[] = []
  let totalProcessed = 0

  for (const scraper of SCRAPERS) {
    try {
      const response = await fetchWithRetry(scraper.url, { headers: BROWSER_HEADERS })
      if (!response.ok) {
        errors.push(`${scraper.source}: HTTP ${response.status}`)
        continue
      }

      const html = await response.text()
      const dossiers = scraper.parse(html)

      if (dossiers.length === 0) {
        errors.push(`${scraper.source}: 0 dossiers geparseerd — HTML-structuur mogelijk gewijzigd`)
        continue
      }

      // Als een bron 0 dossiers oplevert slaan we het deactiveren over
      // (zie hierboven: we komen hier alleen met >= 1 dossier), zodat een
      // kapotte parser niet de hele dossierlijst op inactief zet.
      const result = await syncSource(supabase, scraper.source, dossiers)
      perSource[scraper.source] = { scraped: dossiers.length, ...result }
      totalProcessed += dossiers.length
    } catch (err) {
      errors.push(`${scraper.source}: ${err instanceof Error ? err.message : String(err)}`)
    }

    await sleep(2000)
  }

  if (totalProcessed === 0 && errors.length > 0) {
    throw new Error(`Alle dossierbronnen faalden: ${errors.join('; ')}`)
  }

  return { inserted: totalProcessed, details: { perSource, errors } }
}

Deno.serve(async (_req: Request) => {
  return runJob(SOURCE_NAME, (supabase) => scrape(supabase))
})
