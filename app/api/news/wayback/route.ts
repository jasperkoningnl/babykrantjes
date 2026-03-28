// app/api/news/wayback/route.ts
// @version 1.9.0
// Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
// Bronnen: www.nos.nl (primair), www.nu.nl + nos.nl (fallback)
// UPDATE v1.2.0: Multi-source fallback toegevoegd
// UPDATE v1.3.0: Fix cache update in error scenarios + stale cache retry logic
// UPDATE v1.4.0: Cache full headlines for true performance gain
// UPDATE v1.5.0: Simplified - only cache success (prevents overwrite issues)
// UPDATE v1.6.0: Timeout & retry logic + smart CDX strategy + minimum threshold
// UPDATE v1.7.0: Multi-year HTML parser - supports patterns from 2005-2024
// UPDATE v1.7.1: Noise filtering + HTML entities fix + duplicate prevention
// UPDATE v1.8.0: NOS.nl as primary source (no ads), NU.nl as fallback
// UPDATE v1.8.1: Fixed missing topstories (h1.topstory_mainarticle_title, h3.topstory__title) + "laatste" section
// UPDATE v1.8.2: Fix 2019 topstory nested spans + combine sources for pre-2013 dates
// UPDATE v1.8.3: Add styled-components support for 2023+ (data-testid patterns + generic h2)
// UPDATE v1.9.0: Scraping-logica verplaatst naar lib/waybackScraper.ts (hergebruik door scripts en cron)

import { NextRequest, NextResponse } from 'next/server'
import { checkCache, updateCache } from '@/lib/waybackCache'
import {
  findSnapshot,
  fetchSnapshotContent,
  parseHeadlines,
  getWaybackUrl,
  scrapeNewsForDate,
  NEWS_SOURCES,
  MIN_HEADLINES,
  type Headline,
} from '@/lib/waybackScraper'

const API_VERSION = '1.9.0'

interface WaybackNewsResult {
  date: string
  headlines: Headline[]
  totalHeadlines: number
  sources: string[]
  sourceUrl: string
  snapshotTimestamp: string | null
  apiVersion: string
  cacheHit?: boolean
  error?: string
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')

  console.log(`[Wayback News API v${API_VERSION}] Request for date: ${dateParam}`)

  if (!dateParam) {
    return NextResponse.json({
      date: '',
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: 'Date parameter is required (format: YYYY-MM-DD)'
    } as WaybackNewsResult, { status: 400 })
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateParam)) {
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: 'Invalid date format. Use YYYY-MM-DD'
    } as WaybackNewsResult, { status: 400 })
  }

  const requestDate = new Date(dateParam)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (requestDate > today) {
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: 'Cannot fetch news for future dates'
    } as WaybackNewsResult, { status: 400 })
  }

  const minDate = new Date('2005-01-01')
  if (requestDate < minDate) {
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: 'News archives available from 2005 onwards. Earlier dates may have limited or no snapshots.'
    } as WaybackNewsResult)
  }

  try {
    // === CACHE CHECK ===
    const cached = await checkCache(dateParam)

    if (cached && cached.status === 'found' && cached.headlines && cached.headlines.length > 0) {
      console.log(`[Wayback] ⚡ Cache hit! Returning ${cached.headlines.length} headlines (instant)`)
      return NextResponse.json({
        date: dateParam,
        headlines: cached.headlines,
        totalHeadlines: cached.headlines.length,
        sources: cached.sources || [],
        sourceUrl: cached.timestamp ? getWaybackUrl(cached.timestamp, cached.sources?.[0] || 'www.nos.nl') : '',
        snapshotTimestamp: cached.timestamp || null,
        apiVersion: API_VERSION,
        cacheHit: true
      } as WaybackNewsResult)
    }

    console.log(`[Wayback] Querying Archive.org for ${dateParam}...`)

    // === SCRAPE ===
    const result = await scrapeNewsForDate(dateParam)

    if (result.headlines.length > 0) {
      await updateCache(dateParam, {
        status: 'found',
        timestamp: result.timestamp || undefined,
        headlines: result.headlines,
        headlineCount: result.headlines.length,
        sources: result.sources
      })

      return NextResponse.json({
        date: dateParam,
        headlines: result.headlines,
        totalHeadlines: result.headlines.length,
        sources: result.sources,
        sourceUrl: result.timestamp ? getWaybackUrl(result.timestamp, result.sources[0]) : '',
        snapshotTimestamp: result.timestamp,
        apiVersion: API_VERSION,
        cacheHit: false
      } as WaybackNewsResult)
    }

    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: `No archived snapshots found for ${dateParam}. The Wayback Machine may not have captured any sources on this date.`
    } as WaybackNewsResult)

  } catch (error) {
    console.error(`[Wayback News API] Error:`, error)

    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      sources: [],
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as WaybackNewsResult, { status: 500 })
  }
}
