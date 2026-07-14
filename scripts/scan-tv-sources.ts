#!/usr/bin/env tsx
// scripts/scan-tv-sources.ts
// @version 2.0.0
// Scant de Wayback Machine op beschikbaarheid van tv-gids bronnen.
// Steekproef: 12 datums per jaar (1e dag van elke maand) per kandidaat-URL.
// Schrijft rapport naar data/tv-source-report.json.
//
// Gebruik (lokaal draaien, niet via GitHub Actions — archive.org throttlet
// en blokkeert datacenter-IP's, waardoor de meting onbetrouwbaar wordt):
//   npx tsx scripts/scan-tv-sources.ts
//   npx tsx scripts/scan-tv-sources.ts --from 2010 --to 2024
//   npx tsx scripts/scan-tv-sources.ts --sources extra-sources.json
//   npx tsx scripts/scan-tv-sources.ts --delay 3000
//
// v2.0.0:
// - Drie statussen per check: found | not_found | error (met HTTP-status),
//   zodat een geblokkeerde/gethrottlede runner niet hetzelfde rapport
//   oplevert als "bron bestaat niet".
// - Gebruikt fetchWithRetry (lib/waybackFetch.ts) met exponential backoff
//   in plaats van kale fetch.
// - Delay tussen CDX-requests verhoogd naar minimaal 2 s (instelbaar).
// - Sanity-check vooraf: een bekende-goede referentie-URL (uzg 2015-06-01)
//   moet vindbaar zijn. Zo niet, dan wordt de scan afgebroken en wordt er
//   géén rapport weggeschreven.
// - Per bron en per jaar worden errors apart gerapporteerd van not_found;
//   bij een te hoog foutpercentage wordt het rapport afgekeurd.

import path from 'path'
import fs from 'fs/promises'
import { fetchWithRetry } from '../lib/waybackFetch'

// =============================================================================
// Kandidaat tv-gids bronnen
// Gebruik {DATE} als placeholder voor YYYY-MM-DD
// Gebruik {DDMMYYYY} voor het DD-MM-YYYY formaat
// Gebruik {DDMMYY} voor DD-MM-YY formaat
// =============================================================================

interface TVSource {
  name: string
  urlTemplate: string       // URL met {DATE}, {DDMMYYYY} etc. als placeholder
  notes?: string
}

const TV_SOURCES: TVSource[] = [
  {
    name: 'tvgids.nl (datum in URL)',
    urlTemplate: 'https://www.tvgids.nl/gids/?d={DATE}',
    notes: 'Grootste Nederlandse tv-gids, date-in-URL'
  },
  {
    name: 'tvgids.nl (alternatief formaat)',
    urlTemplate: 'https://www.tvgids.nl/{DATE}/',
  },
  {
    name: 'tvblik.nl (datum in URL)',
    urlTemplate: 'https://www.tvblik.nl/tvgids/{DATE}',
    notes: 'Al in gebruik voor recente datums'
  },
  {
    name: 'uitzendinggemist.net (al in gebruik)',
    urlTemplate: 'https://www.uitzendinggemist.net/op/{DDMMYYYY}.html',
    notes: 'Al werkend t/m 2024-02-20 — ter referentie'
  },
  {
    name: 'teletext.nl (NL1 300)',
    urlTemplate: 'https://www.teletext.nl/nederland1/300/',
    notes: 'Vaste URL — geen datum in URL, Wayback snapshots per dag'
  },
  {
    name: 'tvwijzer.nl',
    urlTemplate: 'https://www.tvwijzer.nl/gids/{DATE}',
  },
  {
    name: 'liveTV.nl',
    urlTemplate: 'https://www.livetv.nl/gids/{DATE}',
  },
  {
    name: 'tvgids.tv',
    urlTemplate: 'https://www.tvgids.tv/gids/{DATE}',
  },
]

// Bekende-goede referentie: uitzendinggemist.net heeft aantoonbaar Wayback-
// snapshots rond deze datum (bron werkt t/m 20-02-2024 in Layer 1).
// Als deze check niets vindt, is de runner geblokkeerd/gethrottled en is
// elke verdere meting waardeloos.
const SANITY_CHECK = {
  url: 'https://www.uitzendinggemist.net/op/01062015.html',
  dateYYYYMMDD: '20150601',
  label: 'uitzendinggemist.net 2015-06-01'
}

// Rapport wordt afgekeurd als meer dan dit percentage van alle checks
// op een fout eindigde (geen betrouwbare dekking-conclusie mogelijk).
const MAX_ERROR_RATE = 0.10

// =============================================================================
// CDX API helpers
// =============================================================================

type CheckStatus = 'found' | 'not_found' | 'error'

interface CDXResult {
  date: string
  status: CheckStatus
  timestamp?: string
  statusCode?: string    // Wayback snapshot status (bij found)
  httpStatus?: number    // HTTP-status van de CDX-call zelf (bij error)
  errorMessage?: string  // Netwerkfout/timeout (bij error)
}

async function checkWaybackCDX(url: string, dateYYYYMMDD: string): Promise<CDXResult> {
  const date = `${dateYYYYMMDD.slice(0, 4)}-${dateYYYYMMDD.slice(4, 6)}-${dateYYYYMMDD.slice(6, 8)}`
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&from=${dateYYYYMMDD}&to=${dateYYYYMMDD}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=3`

  try {
    const response = await fetchWithRetry(cdxUrl, {
      headers: { 'User-Agent': 'Babykrant/1.0 (educational project)' }
    })

    if (!response.ok) {
      // Na alle retries nog steeds een foutstatus: dit is een mislukte
      // meting, géén bewijs dat de bron niet bestaat.
      return { date, status: 'error', httpStatus: response.status }
    }

    const data = await response.json() as string[][]
    if (data.length < 2) return { date, status: 'not_found' }

    const record = data[1] // Eerste data-rij (na header)
    return {
      date,
      status: 'found',
      timestamp: record[1],
      statusCode: record[4]
    }
  } catch (err: any) {
    // fetchWithRetry gooit pas na uitputting van alle retries.
    return { date, status: 'error', errorMessage: err?.message || String(err) }
  }
}

function buildUrl(template: string, date: string): string {
  const [year, month, day] = date.split('-')
  const ddmmyyyy = `${day}${month}${year}`
  const ddmmyy = `${day}${month}${year.slice(2)}`

  return template
    .replace('{DATE}', date)
    .replace('{DDMMYYYY}', ddmmyyyy)
    .replace('{DDMMYY}', ddmmyy)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// =============================================================================
// Rapport structuur
// =============================================================================

interface YearStats {
  sampledDates: number
  found: number
  notFound: number
  errors: number
  coverage: string       // found / (found + notFound) — errors tellen niet mee
  measuredDates: number  // found + notFound (geslaagde metingen)
}

interface SourceReport {
  name: string
  urlTemplate: string
  notes?: string
  byYear: Record<string, YearStats>
  totalSampled: number
  totalFound: number
  totalNotFound: number
  totalErrors: number
  overallCoverage: string  // op basis van geslaagde metingen
  errorRate: string
  bestYears: string[]
  worstYears: string[]
  errorSamples: Array<{ date: string; httpStatus?: number; errorMessage?: string }>
}

// =============================================================================
// CLI argument parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  let fromYear = 2010
  let toYear = new Date().getFullYear() - 1 // Vorig jaar als default
  let extraSourcesFile: string | null = null
  let delayMs = 2000

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) fromYear = parseInt(args[++i])
    else if (args[i] === '--to' && args[i + 1]) toYear = parseInt(args[++i])
    else if (args[i] === '--sources' && args[i + 1]) extraSourcesFile = args[++i]
    else if (args[i] === '--delay' && args[i + 1]) delayMs = parseInt(args[++i])
  }

  // CDX API is streng gethrottled: nooit sneller dan 2 s tussen requests.
  if (!Number.isFinite(delayMs) || delayMs < 2000) delayMs = 2000

  return { fromYear, toYear, extraSourcesFile, delayMs }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const { fromYear, toYear, extraSourcesFile, delayMs } = parseArgs()

  console.log(`\n=== Babykrant TV Source Scanner v2.0.0 ===`)
  console.log(`Periode: ${fromYear} → ${toYear}`)
  console.log(`Delay tussen requests: ${delayMs} ms`)
  console.log(`Bronnen: ${TV_SOURCES.length} kandidaten\n`)

  // Sanity-check: als de bekende-goede referentie niet vindbaar is, is de
  // runner geblokkeerd of gethrottled en zou elke verdere meting een vals
  // "0% dekking"-rapport opleveren. Dan stoppen we meteen.
  console.log(`Sanity-check: ${SANITY_CHECK.label} ...`)
  const sanity = await checkWaybackCDX(SANITY_CHECK.url, SANITY_CHECK.dateYYYYMMDD)
  if (sanity.status !== 'found') {
    console.error(`\n❌ Sanity-check GEFAALD (status: ${sanity.status}${sanity.httpStatus ? `, HTTP ${sanity.httpStatus}` : ''}${sanity.errorMessage ? `, ${sanity.errorMessage}` : ''}).`)
    console.error(`De referentie-URL heeft aantoonbaar Wayback-snapshots; als die niet`)
    console.error(`gevonden wordt, wordt dit IP geblokkeerd of gethrottled door archive.org.`)
    console.error(`Er wordt GEEN rapport weggeschreven. Draai de scan vanaf een ander`)
    console.error(`(residentieel) IP, of probeer het later opnieuw.`)
    process.exit(2)
  }
  console.log(`✓ Sanity-check geslaagd (snapshot ${sanity.timestamp})\n`)

  // Laad eventuele extra bronnen
  let sources = [...TV_SOURCES]
  if (extraSourcesFile) {
    try {
      const data = await fs.readFile(extraSourcesFile, 'utf-8')
      const extra = JSON.parse(data) as TVSource[]
      sources = [...sources, ...extra]
      console.log(`Extra bronnen geladen uit ${extraSourcesFile}: +${extra.length}\n`)
    } catch (err) {
      console.warn(`Kon extra bronnen niet laden: ${err}`)
    }
  }

  // Steekproef-datums: 1e van elke maand per jaar
  const sampleDates: string[] = []
  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      sampleDates.push(`${year}-${String(month).padStart(2, '0')}-01`)
    }
  }

  console.log(`Steekproef: ${sampleDates.length} datums (12 per jaar)\n`)

  const reports: SourceReport[] = []
  let grandTotalChecks = 0
  let grandTotalErrors = 0

  for (const source of sources) {
    console.log(`\n── ${source.name} ──`)
    console.log(`   URL: ${source.urlTemplate}`)

    const byYear: Record<string, { found: number; notFound: number; errors: number; total: number }> = {}
    const errorSamples: SourceReport['errorSamples'] = []

    let totalFound = 0
    let totalNotFound = 0
    let totalErrors = 0
    let processedDates = 0

    for (const date of sampleDates) {
      const year = date.split('-')[0]
      if (!byYear[year]) byYear[year] = { found: 0, notFound: 0, errors: 0, total: 0 }
      byYear[year].total++

      const url = buildUrl(source.urlTemplate, date)
      const dateYYYYMMDD = date.replace(/-/g, '')
      const result = await checkWaybackCDX(url, dateYYYYMMDD)

      if (result.status === 'found') {
        byYear[year].found++
        totalFound++
        process.stdout.write('✓')
      } else if (result.status === 'error') {
        byYear[year].errors++
        totalErrors++
        if (errorSamples.length < 10) {
          errorSamples.push({ date, httpStatus: result.httpStatus, errorMessage: result.errorMessage })
        }
        process.stdout.write('!')
      } else {
        byYear[year].notFound++
        totalNotFound++
        process.stdout.write('✗')
      }

      processedDates++

      // Nieuwe regel per jaar (12 datums)
      if (processedDates % 12 === 0) {
        const y = date.split('-')[0]
        const stats = byYear[y]
        const measured = stats.found + stats.notFound
        const pct = measured > 0 ? Math.round((stats.found / measured) * 100) : 0
        const errNote = stats.errors > 0 ? ` (${stats.errors} fouten)` : ''
        process.stdout.write(` ${y}: ${pct}%${errNote}\n   `)
      }

      // Rate limiting — CDX API verdraagt niet meer dan ~1 request per 2 s
      await sleep(delayMs)
    }

    grandTotalChecks += sampleDates.length
    grandTotalErrors += totalErrors

    // Bouw jaarstatistieken
    const yearStats: Record<string, YearStats> = {}
    for (const [year, stats] of Object.entries(byYear)) {
      const measured = stats.found + stats.notFound
      yearStats[year] = {
        sampledDates: stats.total,
        found: stats.found,
        notFound: stats.notFound,
        errors: stats.errors,
        measuredDates: measured,
        coverage: measured > 0 ? `${Math.round((stats.found / measured) * 100)}%` : 'n.v.t. (alleen fouten)'
      }
    }

    const totalMeasured = totalFound + totalNotFound
    const overallCoverage = totalMeasured > 0 ? Math.round((totalFound / totalMeasured) * 100) : 0
    const sortedYears = Object.entries(yearStats)
      .filter(([, s]) => s.measuredDates > 0)
      .sort((a, b) => b[1].found - a[1].found)
    const bestYears = sortedYears.slice(0, 3).map(([y, s]) => `${y} (${s.coverage})`)
    const worstYears = sortedYears.slice(-3).reverse().map(([y, s]) => `${y} (${s.coverage})`)

    reports.push({
      name: source.name,
      urlTemplate: source.urlTemplate,
      notes: source.notes,
      byYear: yearStats,
      totalSampled: sampleDates.length,
      totalFound,
      totalNotFound,
      totalErrors,
      overallCoverage: totalMeasured > 0 ? `${overallCoverage}%` : 'n.v.t. (alleen fouten)',
      errorRate: `${Math.round((totalErrors / sampleDates.length) * 100)}%`,
      bestYears,
      worstYears,
      errorSamples
    })

    console.log(`\n   Totaal: ${totalFound} gevonden, ${totalNotFound} niet gevonden, ${totalErrors} fouten`)
    console.log(`   Dekking (excl. fouten): ${totalMeasured > 0 ? `${overallCoverage}%` : 'n.v.t.'}`)
    if (bestYears.length > 0) console.log(`   Beste jaren: ${bestYears.join(', ')}`)
  }

  // Rapport afkeuren bij te veel fouten: dan is de dekking-conclusie
  // niet te onderscheiden van een geblokkeerde runner.
  const errorRate = grandTotalChecks > 0 ? grandTotalErrors / grandTotalChecks : 0
  if (errorRate > MAX_ERROR_RATE) {
    console.error(`\n❌ Foutpercentage te hoog: ${Math.round(errorRate * 100)}% van alle checks faalde (max ${Math.round(MAX_ERROR_RATE * 100)}%).`)
    console.error(`Het rapport is niet betrouwbaar en wordt NIET weggeschreven.`)
    console.error(`Draai de scan vanaf een ander (residentieel) IP of met een hogere --delay.`)
    process.exit(3)
  }

  // Schrijf rapport
  const reportPath = path.join(process.cwd(), 'data', 'tv-source-report.json')
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scannerVersion: '2.0.0',
    period: `${fromYear}-${toYear}`,
    delayMs,
    sanityCheck: { ...SANITY_CHECK, result: 'found', timestamp: sanity.timestamp },
    totalChecks: grandTotalChecks,
    totalErrors: grandTotalErrors,
    errorRate: `${Math.round(errorRate * 100)}%`,
    sources: reports
  }, null, 2))

  // Samenvatting
  console.log(`\n\n=== Samenvatting ===`)
  const ranked = [...reports].sort((a, b) => b.totalFound - a.totalFound)
  for (const r of ranked) {
    console.log(`${r.overallCoverage.padStart(6)} (fouten: ${r.errorRate.padStart(4)}) ${r.name}`)
  }

  console.log(`\nRapport opgeslagen: ${reportPath}`)
  console.log(`\nVolgende stap: kies de beste bron(nen) en bouw de parser(s).`)
}

main().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
