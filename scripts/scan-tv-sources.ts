#!/usr/bin/env tsx
// scripts/scan-tv-sources.ts
// @version 1.0.0
// Scant de Wayback Machine op beschikbaarheid van tv-gids bronnen.
// Steekproef: 12 datums per jaar (1e dag van elke maand) per kandidaat-URL.
// Schrijft rapport naar data/tv-source-report.json.
//
// Gebruik:
//   npx tsx scripts/scan-tv-sources.ts
//   npx tsx scripts/scan-tv-sources.ts --from 2010 --to 2024
//   npx tsx scripts/scan-tv-sources.ts --sources extra-sources.json
//
// Voeg eigen kandidaat-URLs toe door TV_SOURCES hieronder uit te breiden,
// of door een JSON-bestand mee te geven via --sources.

import path from 'path'
import fs from 'fs/promises'

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

// =============================================================================
// CDX API helpers
// =============================================================================

interface CDXResult {
  date: string
  found: boolean
  timestamp?: string
  statusCode?: string
}

async function checkWaybackCDX(url: string, dateYYYYMMDD: string): Promise<CDXResult> {
  const date = `${dateYYYYMMDD.slice(0, 4)}-${dateYYYYMMDD.slice(4, 6)}-${dateYYYYMMDD.slice(6, 8)}`
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&from=${dateYYYYMMDD}&to=${dateYYYYMMDD}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=3`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(cdxUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Babykrant/1.0 (educational project)' }
    })
    clearTimeout(timeout)

    if (!response.ok) return { date, found: false }

    const data = await response.json() as string[][]
    if (data.length < 2) return { date, found: false }

    const record = data[1] // Eerste data-rij (na header)
    return {
      date,
      found: true,
      timestamp: record[1],
      statusCode: record[4]
    }
  } catch {
    return { date, found: false }
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
  coverage: string
}

interface SourceReport {
  name: string
  urlTemplate: string
  notes?: string
  byYear: Record<string, YearStats>
  totalSampled: number
  totalFound: number
  overallCoverage: string
  bestYears: string[]
  worstYears: string[]
}

// =============================================================================
// CLI argument parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  let fromYear = 2010
  let toYear = new Date().getFullYear() - 1 // Vorig jaar als default
  let extraSourcesFile: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) fromYear = parseInt(args[++i])
    else if (args[i] === '--to' && args[i + 1]) toYear = parseInt(args[++i])
    else if (args[i] === '--sources' && args[i + 1]) extraSourcesFile = args[++i]
  }

  return { fromYear, toYear, extraSourcesFile }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const { fromYear, toYear, extraSourcesFile } = parseArgs()

  console.log(`\n=== Babykrant TV Source Scanner v1.0.0 ===`)
  console.log(`Periode: ${fromYear} → ${toYear}`)
  console.log(`Bronnen: ${TV_SOURCES.length} kandidaten\n`)

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

  console.log(`Steekproef: ${sampleDates.length} datums (${12} per jaar)\n`)

  const reports: SourceReport[] = []

  for (const source of sources) {
    console.log(`\n── ${source.name} ──`)
    console.log(`   URL: ${source.urlTemplate}`)

    const byYear: Record<string, { found: number; total: number }> = {}

    let totalFound = 0
    let processedDates = 0

    for (const date of sampleDates) {
      const year = date.split('-')[0]
      if (!byYear[year]) byYear[year] = { found: 0, total: 0 }
      byYear[year].total++

      const url = buildUrl(source.urlTemplate, date)
      const dateYYYYMMDD = date.replace(/-/g, '')
      const result = await checkWaybackCDX(url, dateYYYYMMDD)

      if (result.found) {
        byYear[year].found++
        totalFound++
        process.stdout.write('✓')
      } else {
        process.stdout.write('✗')
      }

      processedDates++

      // Nieuwe regel per jaar (12 datums)
      if (processedDates % 12 === 0) {
        const y = date.split('-')[0]
        const stats = byYear[y]
        const pct = Math.round((stats.found / stats.total) * 100)
        process.stdout.write(` ${y}: ${pct}%\n   `)
      }

      // Rate limiting
      await sleep(300)
    }

    // Bouw jaarstatistieken
    const yearStats: Record<string, YearStats> = {}
    for (const [year, stats] of Object.entries(byYear)) {
      yearStats[year] = {
        sampledDates: stats.total,
        found: stats.found,
        coverage: `${Math.round((stats.found / stats.total) * 100)}%`
      }
    }

    const overallCoverage = Math.round((totalFound / sampleDates.length) * 100)
    const sortedYears = Object.entries(yearStats).sort((a, b) => b[1].found - a[1].found)
    const bestYears = sortedYears.slice(0, 3).map(([y, s]) => `${y} (${s.coverage})`)
    const worstYears = sortedYears.slice(-3).reverse().map(([y, s]) => `${y} (${s.coverage})`)

    reports.push({
      name: source.name,
      urlTemplate: source.urlTemplate,
      notes: source.notes,
      byYear: yearStats,
      totalSampled: sampleDates.length,
      totalFound,
      overallCoverage: `${overallCoverage}%`,
      bestYears,
      worstYears
    })

    console.log(`\n   Totaal: ${totalFound}/${sampleDates.length} (${overallCoverage}%)`)
    console.log(`   Beste jaren: ${bestYears.join(', ')}`)
  }

  // Schrijf rapport
  const reportPath = path.join(process.cwd(), 'data', 'tv-source-report.json')
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    period: `${fromYear}-${toYear}`,
    sources: reports
  }, null, 2))

  // Samenvatting
  console.log(`\n\n=== Samenvatting ===`)
  const ranked = [...reports].sort((a, b) => b.totalFound - a.totalFound)
  for (const r of ranked) {
    console.log(`${r.overallCoverage.padStart(5)} ${r.name}`)
  }

  console.log(`\nRapport opgeslagen: ${reportPath}`)
  console.log(`\nVolgende stap: kies de beste bron(nen) en bouw de parser(s).`)
}

main().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
