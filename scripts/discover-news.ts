#!/usr/bin/env tsx
// scripts/discover-news.ts
// @version 1.0.0
// Bulk discovery script voor nieuws via Wayback Machine.
// Itereert over een datumbereik, scrapet NOS.nl/NU.nl snapshots en slaat
// succesvolle resultaten op in data/cache/news/news-YYYY.json.
//
// Gebruik:
//   npx tsx scripts/discover-news.ts
//   npx tsx scripts/discover-news.ts --from 2010-01-01 --to 2015-12-31
//   npx tsx scripts/discover-news.ts --from 2020-01-01 --resume   # sla bekende datums over
//   npx tsx scripts/discover-news.ts --year 2022                  # alleen één jaar
//
// Opties:
//   --from YYYY-MM-DD   Startdatum (default: 2005-01-01)
//   --to   YYYY-MM-DD   Einddatum  (default: gisteren)
//   --year YYYY         Shorthand voor --from YYYY-01-01 --to YYYY-12-31
//   --resume            Sla datums over die al in de cache staan
//   --dry-run           Laat zien wat er zou worden gedaan zonder te scrapen

import path from 'path'
import fs from 'fs/promises'
import { scrapeNewsForDate, MIN_HEADLINES } from '../lib/waybackScraper'

// =============================================================================
// Cache helpers (standalone, los van waybackCache.ts om server-deps te vermijden)
// =============================================================================

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'news')

interface CacheEntry {
  status: 'found' | 'not_found'
  timestamp?: string
  headlines?: Array<{ title: string; url: string; category: string | null; time: string | null; source: string }>
  sources?: string[]
  lastChecked: string
}

interface YearCache {
  [date: string]: CacheEntry
}

const memoryCache: Record<string, YearCache> = {}

async function readYearCache(year: string): Promise<YearCache> {
  if (memoryCache[year]) return memoryCache[year]
  const filePath = path.join(CACHE_DIR, `news-${year}.json`)
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(data) as YearCache
    memoryCache[year] = parsed
    return parsed
  } catch {
    return {}
  }
}

async function writeYearCache(year: string, cache: YearCache): Promise<void> {
  const filePath = path.join(CACHE_DIR, `news-${year}.json`)
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const sorted: YearCache = {}
  Object.keys(cache).sort().forEach(k => { sorted[k] = cache[k] })
  await fs.writeFile(filePath, JSON.stringify(sorted, null, 2))
  memoryCache[year] = sorted
}

async function isDateCached(date: string): Promise<boolean> {
  const year = date.split('-')[0]
  const cache = await readYearCache(year)
  return !!cache[date]
}

async function cacheDate(date: string, entry: CacheEntry): Promise<void> {
  const year = date.split('-')[0]
  const cache = await readYearCache(year)
  cache[date] = entry
  await writeYearCache(year, cache)
}

// =============================================================================
// CLI argument parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  let from = '2005-01-01'
  let to = (() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  })()
  let resume = false
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { from = args[++i] }
    else if (args[i] === '--to' && args[i + 1]) { to = args[++i] }
    else if (args[i] === '--year' && args[i + 1]) {
      const year = args[++i]
      from = `${year}-01-01`
      to = `${year}-12-31`
    }
    else if (args[i] === '--resume') { resume = true }
    else if (args[i] === '--dry-run') { dryRun = true }
  }

  return { from, to, resume, dryRun }
}

// =============================================================================
// Date iteration
// =============================================================================

function* dateRange(from: string, to: string): Generator<string> {
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    yield current.toISOString().split('T')[0]
    current.setDate(current.getDate() + 1)
  }
}

// =============================================================================
// Progress & logging
// =============================================================================

function formatProgress(current: number, total: number, found: number, skipped: number, failed: number): string {
  const pct = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
  return `[${bar}] ${pct}% (${current}/${total}) | ✓ ${found} gevonden | ⏭ ${skipped} overgeslagen | ✗ ${failed} niet gevonden`
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const { from, to, resume, dryRun } = parseArgs()

  console.log(`\n=== Babykrant News Discovery Script v1.0.0 ===`)
  console.log(`Periode: ${from} → ${to}`)
  if (resume) console.log(`Modus: resume (bekende datums overslaan)`)
  if (dryRun) console.log(`Modus: dry-run (geen scraping, alleen tellen)`)
  console.log()

  // Verzamel alle datums
  const dates = Array.from(dateRange(from, to))
  const total = dates.length
  console.log(`${total} datums te verwerken\n`)

  let current = 0
  let found = 0
  let skipped = 0
  let failed = 0

  for (const date of dates) {
    current++

    // Resume: sla over als al gecached
    if (resume && await isDateCached(date)) {
      skipped++
      if (current % 50 === 0 || current === total) {
        process.stdout.write('\r' + formatProgress(current, total, found, skipped, failed))
      }
      continue
    }

    if (dryRun) {
      const cached = await isDateCached(date)
      if (cached) skipped++
      else found++ // Tellen als "te doen"
      if (current % 50 === 0 || current === total) {
        process.stdout.write('\r' + formatProgress(current, total, found, skipped, failed))
      }
      continue
    }

    // Scrape
    try {
      const result = await scrapeNewsForDate(date)

      if (result.headlines.length >= MIN_HEADLINES) {
        await cacheDate(date, {
          status: 'found',
          timestamp: result.timestamp || undefined,
          headlines: result.headlines,
          sources: result.sources,
          lastChecked: new Date().toISOString()
        })
        found++
        console.log(`\n✓ ${date}: ${result.headlines.length} headlines (${result.sources.join(', ')})`)
      } else if (result.headlines.length > 0) {
        // Accepteer ook als < MIN_HEADLINES maar > 0
        await cacheDate(date, {
          status: 'found',
          timestamp: result.timestamp || undefined,
          headlines: result.headlines,
          sources: result.sources,
          lastChecked: new Date().toISOString()
        })
        found++
        console.log(`\n⚠ ${date}: slechts ${result.headlines.length} headlines (< ${MIN_HEADLINES} ideaal) maar toch gecached`)
      } else {
        failed++
        // Niet cachen — volgende keer opnieuw proberen
      }
    } catch (error) {
      failed++
      console.log(`\n✗ ${date}: fout — ${error instanceof Error ? error.message : error}`)
    }

    process.stdout.write('\r' + formatProgress(current, total, found, skipped, failed))

    // Respecteer Wayback Machine rate limits: ~500ms tussen requests
    await sleep(500)
  }

  console.log(`\n\n=== Klaar ===`)
  console.log(`Gevonden:      ${found}`)
  console.log(`Overgeslagen:  ${skipped}`)
  console.log(`Niet gevonden: ${failed}`)
  console.log(`Cache locatie: data/cache/news/`)
  console.log()
  console.log(`Vergeet niet de JSON-bestanden te committen:`)
  console.log(`  git add data/cache/news/ && git commit -m "chore: news cache ${from} tot ${to}"`)
}

main().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
