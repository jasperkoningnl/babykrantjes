// app/api/cron/cache-yesterday/route.ts
// @version 1.0.0
// Dagelijkse cron job: scrapt nieuws (en straks TV) voor gisteren en slaat op in Redis.
// Draait automatisch via Vercel Cron (zie vercel.json) elke nacht om 3:00 UTC.
//
// Handmatig testen:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://jouw-app.vercel.app/api/cron/cache-yesterday
// Lokaal:
//   curl http://localhost:3000/api/cron/cache-yesterday

import { NextRequest, NextResponse } from 'next/server'
import { checkCache, updateCache } from '@/lib/waybackCache'
import { scrapeNewsForDate, MIN_HEADLINES } from '@/lib/waybackScraper'

const CRON_VERSION = '1.0.0'

interface CronResult {
  date: string
  news: {
    status: 'cached' | 'already_cached' | 'not_found' | 'error'
    headlineCount?: number
    sources?: string[]
    error?: string
  }
  tv: {
    status: 'skipped'
    note: string
  }
  duration_ms: number
  version: string
}

export async function GET(request: NextRequest) {
  const start = Date.now()

  // Optioneel: beveilig de cron route met een secret
  // Vercel stuurt automatisch de juiste header; handmatige aanroepen hebben dit nodig.
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Bereken gisteren
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const date = yesterday.toISOString().split('T')[0]

  console.log(`[CronJob v${CRON_VERSION}] Caching data for ${date}`)

  // ==========================================================================
  // Nieuws
  // ==========================================================================

  let newsResult: CronResult['news']

  try {
    // Check of gisteren al in cache zit
    const cached = await checkCache(date)
    if (cached?.status === 'found' && cached.headlines && cached.headlines.length > 0) {
      console.log(`[CronJob] Nieuws voor ${date} al in cache (${cached.headlines.length} headlines)`)
      newsResult = {
        status: 'already_cached',
        headlineCount: cached.headlines.length,
        sources: cached.sources
      }
    } else {
      // Scrape nieuws voor gisteren
      console.log(`[CronJob] Scraping nieuws voor ${date}...`)
      const result = await scrapeNewsForDate(date)

      if (result.headlines.length > 0) {
        await updateCache(date, {
          status: 'found',
          timestamp: result.timestamp || undefined,
          headlines: result.headlines,
          headlineCount: result.headlines.length,
          sources: result.sources
        })

        console.log(`[CronJob] ✓ Nieuws gecached: ${result.headlines.length} headlines van ${result.sources.join(', ')}`)
        newsResult = {
          status: 'cached',
          headlineCount: result.headlines.length,
          sources: result.sources
        }
      } else {
        console.log(`[CronJob] Geen nieuws gevonden voor ${date}`)
        newsResult = {
          status: 'not_found'
        }
      }
    }
  } catch (error) {
    console.error(`[CronJob] Nieuws error voor ${date}:`, error)
    newsResult = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }

  // ==========================================================================
  // TV
  // TV-caching wordt toegevoegd zodra de bron-discovery compleet is
  // en de juiste parser beschikbaar is. Tot dan: no-op.
  // ==========================================================================

  const tvResult: CronResult['tv'] = {
    status: 'skipped',
    note: 'TV caching wordt toegevoegd na bron-discovery (scripts/scan-tv-sources.ts)'
  }

  const duration = Date.now() - start
  console.log(`[CronJob] Klaar in ${duration}ms`)

  return NextResponse.json({
    date,
    news: newsResult,
    tv: tvResult,
    duration_ms: duration,
    version: CRON_VERSION
  } as CronResult)
}
