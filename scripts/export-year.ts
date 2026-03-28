#!/usr/bin/env tsx
// scripts/export-year.ts
// @version 1.0.0
// Exporteert gecachte nieuws-data uit Redis naar een statisch JSON-bestand.
// Draai dit aan het einde van elk jaar om de cache permanent te bewaren in Git.
//
// Gebruik:
//   npx tsx scripts/export-year.ts --year 2025
//   npx tsx scripts/export-year.ts --year 2024 --dry-run   # toon wat er geëxporteerd zou worden
//
// Vereist:
//   KV_REST_API_URL en KV_REST_API_TOKEN moeten ingesteld zijn (zelfde als Vercel env)
//   Kopieer ze uit je Vercel project settings of .env.local

import path from 'path'
import fs from 'fs/promises'

// Laad .env.local als dat bestaat (voor lokaal gebruik)
try {
  const envPath = path.join(process.cwd(), '.env.local')
  const envContent = await fs.readFile(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
} catch {
  // Geen .env.local — prima, env vars zijn dan al ingesteld
}

// =============================================================================
// CLI argument parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  let year: string | null = null
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) year = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
  }

  if (!year) {
    console.error('Fout: --year is verplicht. Gebruik: npx tsx scripts/export-year.ts --year 2025')
    process.exit(1)
  }

  return { year, dryRun }
}

// =============================================================================
// Redis helpers (zonder @upstash/redis te importeren — gebruikt fetch direct)
// =============================================================================

async function redisGet(key: string): Promise<unknown> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) throw new Error('KV_REST_API_URL en/of KV_REST_API_TOKEN niet ingesteld')

  const response = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!response.ok) return null
  const data = await response.json() as { result: unknown }
  return data.result
}

async function redisScan(pattern: string): Promise<string[]> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) throw new Error('KV_REST_API_URL en/of KV_REST_API_TOKEN niet ingesteld')

  // Upstash REST API: SCAN via /scan/{cursor}?match={pattern}&count=100
  const keys: string[] = []
  let cursor = 0

  do {
    const response = await fetch(`${url}/scan/${cursor}?match=${encodeURIComponent(pattern)}&count=100`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) break

    const data = await response.json() as { result: [string, string[]] }
    const [nextCursor, batch] = data.result
    keys.push(...batch)
    cursor = parseInt(nextCursor)
  } while (cursor !== 0)

  return keys
}

// =============================================================================
// Cache types (gelijkt aan waybackCache.ts)
// =============================================================================

interface WaybackHeadline {
  title: string
  url: string
  category: string | null
  time: string | null
  source: string
}

interface CacheEntry {
  status: 'found' | 'not_found' | 'too_old'
  timestamp?: string
  headlines?: WaybackHeadline[]
  headlineCount?: number
  sources?: string[]
  reason?: string
  lastChecked: string
}

interface YearCache {
  [date: string]: CacheEntry
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const { year, dryRun } = parseArgs()

  console.log(`\n=== Babykrant Year Export Script v1.0.0 ===`)
  console.log(`Export jaar: ${year}`)
  if (dryRun) console.log(`Modus: dry-run\n`)
  else console.log()

  // Haal alle Redis-sleutels op voor dit jaar
  const pattern = `wayback:${year}-*`
  console.log(`Zoeken naar Redis-sleutels: ${pattern}`)

  let keys: string[]
  try {
    keys = await redisScan(pattern)
  } catch (error) {
    console.error(`Fout bij ophalen Redis-sleutels: ${error instanceof Error ? error.message : error}`)
    console.error('\nZorg dat KV_REST_API_URL en KV_REST_API_TOKEN zijn ingesteld.')
    console.error('Kopieer ze uit je Vercel project settings naar .env.local')
    process.exit(1)
  }

  console.log(`${keys.length} sleutels gevonden voor jaar ${year}\n`)

  if (keys.length === 0) {
    console.log('Geen data gevonden in Redis voor dit jaar.')
    console.log('Tip: draai dit script nadat de cron-job het jaar heeft gevuld,')
    console.log('     of gebruik scripts/discover-news.ts om de cache te vullen.')
    return
  }

  // Haal alle entries op
  console.log('Ophalen van entries uit Redis...')
  const yearCache: YearCache = {}
  let fetched = 0
  let found = 0

  for (const key of keys) {
    // Zet Redis-sleutel om naar datum: "wayback:2025-03-15" → "2025-03-15"
    const date = key.replace('wayback:', '')

    try {
      const entry = await redisGet(key) as CacheEntry | null
      if (entry && entry.status === 'found') {
        yearCache[date] = entry
        found++
      }
      fetched++

      if (fetched % 20 === 0) {
        process.stdout.write(`\r${fetched}/${keys.length} opgehaald (${found} met data)`)
      }
    } catch {
      // Sla over bij fout
    }
  }

  console.log(`\r${fetched}/${keys.length} opgehaald (${found} met data)\n`)

  if (found === 0) {
    console.log('Geen succesvolle cache-entries gevonden voor dit jaar.')
    return
  }

  // Sorteer op datum
  const sorted: YearCache = {}
  Object.keys(yearCache).sort().forEach(k => { sorted[k] = yearCache[k] })

  // Schrijf naar bestand
  const outputDir = path.join(process.cwd(), 'data', 'cache', 'news')
  const outputPath = path.join(outputDir, `news-${year}.json`)

  if (dryRun) {
    console.log(`Dry-run: zou schrijven naar ${outputPath}`)
    console.log(`Datums: ${Object.keys(sorted).slice(0, 5).join(', ')}... (${found} totaal)`)
    return
  }

  // Check of bestand al bestaat
  try {
    const existing = await fs.readFile(outputPath, 'utf-8')
    const existingData = JSON.parse(existing) as YearCache
    const existingCount = Object.keys(existingData).length

    console.log(`Bestaand bestand gevonden: ${outputPath} (${existingCount} entries)`)
    console.log(`Samenvoegen met ${found} nieuwe entries uit Redis...`)

    // Merge: bestaande data + nieuwe data (Redis wint bij conflict)
    const merged: YearCache = { ...existingData, ...sorted }
    const sortedMerged: YearCache = {}
    Object.keys(merged).sort().forEach(k => { sortedMerged[k] = merged[k] })

    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, JSON.stringify(sortedMerged, null, 2))

    const finalCount = Object.keys(sortedMerged).length
    console.log(`✓ Samengevoegd: ${finalCount} entries`)
  } catch {
    // Bestand bestaat niet — nieuw aanmaken
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, JSON.stringify(sorted, null, 2))
    console.log(`✓ Nieuw bestand aangemaakt: ${outputPath} (${found} entries)`)
  }

  console.log(`\nBestand opgeslagen: ${outputPath}`)
  console.log(`\nVolgende stap: commit dit bestand naar Git:`)
  console.log(`  git add data/cache/news/news-${year}.json`)
  console.log(`  git commit -m "chore: news cache jaar ${year}"`)
}

main().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
