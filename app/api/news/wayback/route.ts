// app/api/news/wayback/route.ts
// @version 1.7.0
// Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
// Bronnen: www.nu.nl (primair), www.nos.nl + nos.nl (fallback)
// UPDATE v1.2.0: Multi-source fallback toegevoegd
// UPDATE v1.3.0: Fix cache update in error scenarios + stale cache retry logic
// UPDATE v1.4.0: Cache full headlines for true performance gain
// UPDATE v1.5.0: Simplified - only cache success (prevents overwrite issues)
// UPDATE v1.6.0: Timeout & retry logic + smart CDX strategy + minimum threshold
// UPDATE v1.7.0: Multi-year HTML parser - supports patterns from 2005-2024

import { NextRequest, NextResponse } from 'next/server'
import { checkCache, updateCache, type WaybackHeadline } from '@/lib/waybackCache'
import { fetchWithRetry } from '@/lib/waybackFetch'

const API_VERSION = '1.7.0'

// Reliability settings
const MIN_HEADLINES = 5  // Minimum number of headlines to accept as valid result (lowered from 10 for better coverage)
const CDX_LIMIT = 20  // Number of snapshots to fetch (increased from 5)

// News sources to try (in order)
const NEWS_SOURCES = {
  primary: ['www.nu.nl'],
  fallback: ['www.nos.nl', 'nos.nl']
}

// Types
interface WaybackSnapshot {
  timestamp: string
  url: string
  status: string
  mimeType: string
  source: string
}

// Use WaybackHeadline from cache (imported above)
type Headline = WaybackHeadline

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

// CDX API response format: [urlkey, timestamp, original, mimetype, statuscode, digest, length]
type CDXRecord = [string, string, string, string, string, string, string]

/**
 * Zoekt de beste snapshot van een specifieke bron op een specifieke datum via CDX API
 * v1.6.0: Smart strategy - prefer snapshots during peak news hours (12:00-20:00)
 * v1.6.1: Try both HTTP and HTTPS explicitly for older snapshots
 */
async function findSnapshot(date: string, source: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`

  // Try both HTTP and HTTPS (older snapshots are HTTP, newer are HTTPS)
  const protocols = ['http', 'https']
  let allSnapshots: Array<{
    timestamp: string
    url: string
    status: string
    mimeType: string
    hour: number
    score: number
  }> = []

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const domain = source.replace(/^www\./, '')
    const fullUrl = `${prefix}${domain}/`
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${fullUrl}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=${CDX_LIMIT}`

    console.log(`[Wayback] CDX query [${source}] via ${protocol.toUpperCase()}: ${cdxUrl}`)

    try {
      const response = await fetchWithRetry(cdxUrl, {
        headers: {
          'User-Agent': 'Babykrant/1.0 (educational project)'
        }
      })

      if (!response.ok) {
        console.log(`[Wayback] CDX ${protocol.toUpperCase()} error: ${response.status}`)
        continue
      }

      const data = await response.json() as CDXRecord[]

      // Eerste rij is header, daarna data
      if (data.length < 2) {
        console.log(`[Wayback] No ${protocol.toUpperCase()} snapshots found for ${source} on ${date}`)
        continue
      }

      // Parse snapshots from this protocol
      const snapshots = data.slice(1).map(record => {
        const [urlkey, timestamp, original, mimetype, statuscode, digest, length] = record
        const hour = parseInt(timestamp.substring(8, 10))

        // Score based on time of day
        let score = 1
        if (hour >= 12 && hour <= 20) {
          score = 10
        } else if (hour >= 8 && hour < 12) {
          score = 5
        }

        return {
          timestamp,
          url: original,
          status: statuscode,
          mimeType: mimetype,
          hour,
          score
        }
      })

      allSnapshots.push(...snapshots)
      console.log(`[Wayback] Found ${snapshots.length} ${protocol.toUpperCase()} snapshots`)

    } catch (error) {
      console.log(`[Wayback] CDX ${protocol.toUpperCase()} fetch error:`, error)
      continue
    }
  }

  if (allSnapshots.length === 0) {
    console.log(`[Wayback] No snapshots found for ${source} on ${date} (tried both HTTP and HTTPS)`)
    return null
  }

  // Sort all snapshots by score and pick best
  allSnapshots.sort((a, b) => b.score - a.score)
  const best = allSnapshots[0]

  console.log(`[Wayback] Selected snapshot at ${best.hour}:${best.timestamp.substring(10, 12)} (score: ${best.score}, ${allSnapshots.length} total snapshots from both protocols)`)

  return {
    timestamp: best.timestamp,
    url: best.url,
    status: best.status,
    mimeType: best.mimeType,
    source
  }
}

/**
 * Haalt de HTML content van een Wayback snapshot op
 * v1.6.0: Uses fetchWithRetry for better reliability
 * v1.6.1: HTTP/HTTPS fallback for older snapshots (pre-2018)
 */
async function fetchSnapshotContent(timestamp: string, source: string): Promise<string | null> {
  const domain = source.replace(/^www\./, '')

  // Try both HTTPS and HTTP (older snapshots are often HTTP-only)
  const protocols = ['https', 'http']

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${prefix}${domain}/`

    console.log(`[Wayback] Fetching [${source}] via ${protocol.toUpperCase()}: ${waybackUrl}`)

    try {
      const response = await fetchWithRetry(waybackUrl, {
        headers: {
          'User-Agent': 'Babykrant/1.0 (educational project)',
          'Accept': 'text/html'
        }
      })

      if (response.ok) {
        console.log(`[Wayback] ✓ Success with ${protocol.toUpperCase()}`)
        return await response.text()
      }

      console.log(`[Wayback] ${protocol.toUpperCase()} failed with status ${response.status}, trying next...`)
    } catch (error: any) {
      console.log(`[Wayback] ${protocol.toUpperCase()} failed: ${error.message}, trying next...`)
    }
  }

  console.error(`[Wayback] All protocols failed for [${source}]`)
  return null
}

/**
 * Parseert headlines uit nu.nl HTML content
 * v1.7.0: Multi-year parser - probeert verschillende patterns voor verschillende tijdsperiodes
 * Patterns gebaseerd op HTML evolutie van nu.nl (2005-2024)
 */
function parseNuNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()

  // Extract categorie uit URL: /binnenland/, /buitenland/, /economie/, etc.
  const extractCategory = (url: string): string | null => {
    const match = url.match(/nu\.nl\/([a-z-]+)\//)
    if (match && match[1]) {
      const cat = match[1]
      // Filter out non-news categories
      if (['advertorial', 'nushop', 'tag', 'zoeken'].includes(cat)) return null
      // Capitalize
      return cat.charAt(0).toUpperCase() + cat.slice(1)
    }
    return null
  }

  // Helper to add headline with deduplication
  const addHeadline = (title: string, url: string = '', category: string | null = null, time: string | null = null) => {
    const cleanTitle = decodeHtmlEntities(title.trim())
      .replace(/^(Video|Podcast|Liveblog[^:]*:?)\s*/i, '')
      .trim()

    if (cleanTitle && cleanTitle.length > 10 && !seen.has(cleanTitle.toLowerCase())) {
      seen.add(cleanTitle.toLowerCase())

      // Clean Wayback URL if present
      let cleanUrl = url
      if (url) {
        const originalUrlMatch = url.match(/\/web\/\d+\/(.+)/)
        cleanUrl = originalUrlMatch ? 'https://' + originalUrlMatch[1].replace(/^https?:\/\//, '') : url
      }

      headlines.push({
        title: cleanTitle,
        url: cleanUrl,
        category,
        time,
        source
      })
    }
  }

  // === MODERN PATTERNS (2018-2024) ===
  // Pattern 1: item-title__title spans met title attribuut
  const modernTitleAttr = /<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi
  let match
  while ((match = modernTitleAttr.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 2: item-title__title spans met content
  const modernSpanContent = /<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)\s*<\/span>/gi
  while ((match = modernSpanContent.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 3: Modern links met item-title__title
  const modernLink = /<a[^>]*href="([^"]*\/nu\.nl\/[^"]+\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)/gi
  while ((match = modernLink.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // === LEGACY PATTERNS (2012-2018) ===
  // Pattern 4: span class="title" (gebruikt in 2014-2017 periode)
  const legacySpanTitle = /<span[^>]*class="title"[^>]*>([^<]+)<\/span>/gi
  while ((match = legacySpanTitle.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 5: h3 met links (gebruikt in 2010-2016 periode)
  // <h3><a href="...">Headline</a></h3>
  const legacyH3Link = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi
  while ((match = legacyH3Link.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 6: h3 zonder link maar met content
  const legacyH3Content = /<h3[^>]*>([^<]+)<\/h3>/gi
  while ((match = legacyH3Content.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // === FALLBACK PATTERNS (2005-2012) ===
  // Pattern 7: h2 headers (vroege nu.nl versies)
  const fallbackH2 = /<h2[^>]*>\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h2>/gi
  while ((match = fallbackH2.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 8: artikel links met class
  const fallbackArticleLink = /<a[^>]*class="[^"]*article[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = fallbackArticleLink.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 9: div class title (zeer oude versies)
  const fallbackDivTitle = /<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/gi
  while ((match = fallbackDivTitle.exec(html)) !== null) {
    addHeadline(match[1])
  }

  console.log(`[Wayback] Parsed ${headlines.length} unique headlines from ${source} (multi-year parser)`)

  return headlines
}

/**
 * Parseert headlines uit nos.nl HTML content
 * v1.7.0: Multi-year parser voor NOS.nl - verschillende patterns voor verschillende periodes
 */
function parseNosNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()

  // Extract categorie uit URL: /nieuws/binnenland/, /sport/, etc.
  const extractCategory = (url: string): string | null => {
    const match = url.match(/nos\.nl\/(nieuws\/)?([a-z-]+)\//)
    if (match && match[2]) {
      const cat = match[2]
      if (['artikel', 'video', 'audio', 'uitzending'].includes(cat)) return null
      return cat.charAt(0).toUpperCase() + cat.slice(1)
    }
    return null
  }

  // Extract original URL from Wayback URL
  const cleanWaybackUrl = (url: string): string => {
    const match = url.match(/\/web\/\d+\/(.+)/)
    if (match) {
      const cleanedUrl = match[1].replace(/^https?:\/\//, '')
      return 'https://' + cleanedUrl
    }
    return url
  }

  // Helper to add headline with deduplication
  const addHeadline = (title: string, url: string = '', category: string | null = null, time: string | null = null) => {
    const cleanTitle = decodeHtmlEntities(title.trim())
    if (cleanTitle && cleanTitle.length > 10 && !seen.has(cleanTitle.toLowerCase())) {
      seen.add(cleanTitle.toLowerCase())
      headlines.push({
        title: cleanTitle,
        url: url ? cleanWaybackUrl(url) : '',
        category,
        time,
        source
      })
    }
  }

  let match

  // === MODERN PATTERNS (2015-2024) ===
  // Pattern 1: Top story
  const topStoryPattern = /<div[^>]*class="[^"]*top-story[^"]*"[^>]*>[\s\S]*?<strong>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/strong>/gi
  while ((match = topStoryPattern.exec(html)) !== null) {
    addHeadline(match[2], match[1], 'Top Story')
  }

  // Pattern 2: Featured headlines
  const featuredPattern = /<li[^>]*class="[^"]*big[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = featuredPattern.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 3: Category headlines
  const categoryPattern = /<li[^>]*class="[^"]*click[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi
  while ((match = categoryPattern.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 4: Latest news with timestamps
  const latestPattern = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="time"[^>]*>(\d{1,2}:\d{2})<\/span>[\s\S]*?<strong>([^<]+)<\/strong>/gi
  while ((match = latestPattern.exec(html)) !== null) {
    const title = match[4] || match[2]
    addHeadline(title, match[1], extractCategory(match[1]), match[3])
  }

  // === LEGACY PATTERNS (2010-2015) ===
  // Pattern 5: h3 headlines met links
  const legacyH3Link = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi
  while ((match = legacyH3Link.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 6: h3 zonder link
  const legacyH3Content = /<h3[^>]*>([^<]+)<\/h3>/gi
  while ((match = legacyH3Content.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 7: h2 headlines
  const legacyH2 = /<h2[^>]*>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h2>/gi
  while ((match = legacyH2.exec(html)) !== null) {
    addHeadline(match[2], match[1] || '', extractCategory(match[1] || ''))
  }

  // === FALLBACK PATTERNS (2005-2010) ===
  // Pattern 8: div/span met class title
  const fallbackTitle = /<(?:div|span)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/(?:div|span)>/gi
  while ((match = fallbackTitle.exec(html)) !== null) {
    addHeadline(match[1])
  }

  // Pattern 9: Strong binnen link (vroege NOS structuur)
  const fallbackStrongLink = /<a[^>]*href="([^"]*)"[^>]*>\s*<strong>([^<]+)<\/strong>\s*<\/a>/gi
  while ((match = fallbackStrongLink.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  // Pattern 10: artikel links met NOS.nl URL
  const fallbackNosLink = /<a[^>]*href="([^"]*nos\.nl\/artikel\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = fallbackNosLink.exec(html)) !== null) {
    addHeadline(match[2], match[1], extractCategory(match[1]))
  }

  console.log(`[Wayback] Parsed ${headlines.length} unique headlines from ${source} (multi-year parser)`)

  return headlines
}

/**
 * Kiest de juiste parser op basis van de bron
 */
function parseHeadlines(html: string, source: string): Headline[] {
  if (source === 'www.nu.nl') {
    return parseNuNlHeadlines(html, source)
  } else if (source === 'www.nos.nl' || source === 'nos.nl') {
    return parseNosNlHeadlines(html, source)
  }
  
  // Fallback: probeer beide parsers
  const nuHeadlines = parseNuNlHeadlines(html, source)
  const nosHeadlines = parseNosNlHeadlines(html, source)
  return nuHeadlines.length > nosHeadlines.length ? nuHeadlines : nosHeadlines
}

/**
 * Decodeert HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

/**
 * Formatteert timestamp naar Wayback URL
 */
function getWaybackUrl(timestamp: string, source: string): string {
  const protocol = source.startsWith('www.') ? 'https://www.' : 'https://'
  const domain = source.replace(/^www\./, '')
  return `https://web.archive.org/web/${timestamp}/${protocol}${domain}/`
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')
  
  console.log(`[Wayback News API v${API_VERSION}] Request for date: ${dateParam}`)
  
  // Valideer datum parameter
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
  
  // Valideer datum formaat
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
  
  // Controleer of datum niet in de toekomst ligt
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
  
  // Controleer minimum datum (Wayback Machine heeft niet alles)
  // Nu.nl bestaat sinds 1999, maar goede snapshots vanaf ~2005
  const minDate = new Date('2005-01-01')
  if (requestDate < minDate) {
    // Don't cache 'too_old' - just return error
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
    // Simple: only successful results are cached, so if found → return immediately
    const cached = await checkCache(dateParam)

    if (cached && cached.status === 'found' && cached.headlines && cached.headlines.length > 0) {
      // Cache hit! Return immediately
      console.log(`[Wayback] ⚡ Cache hit! Returning ${cached.headlines.length} headlines (instant)`)
      return NextResponse.json({
        date: dateParam,
        headlines: cached.headlines,
        totalHeadlines: cached.headlines.length,
        sources: cached.sources || [],
        sourceUrl: cached.timestamp ? getWaybackUrl(cached.timestamp, cached.sources?.[0] || 'www.nu.nl') : '',
        snapshotTimestamp: cached.timestamp || null,
        apiVersion: API_VERSION,
        cacheHit: true
      } as WaybackNewsResult)
    }
    
    console.log(`[Wayback] Querying Archive.org for ${dateParam}...`)
    
    // === MULTI-SOURCE STRATEGY ===
    const allHeadlines: Headline[] = []
    const usedSources: string[] = []
    let primaryTimestamp: string | null = null
    
    // STAP 1: Probeer primaire bron (www.nu.nl)
    for (const source of NEWS_SOURCES.primary) {
      const snapshot = await findSnapshot(dateParam, source)

      if (snapshot) {
        const html = await fetchSnapshotContent(snapshot.timestamp, source)

        if (html) {
          const headlines = parseHeadlines(html, source)

          // v1.6.0: Accept any result > 0, but log if below ideal threshold
          if (headlines.length > 0) {
            if (headlines.length >= MIN_HEADLINES) {
              console.log(`[Wayback] ✓ Primary source ${source} yielded ${headlines.length} headlines`)
            } else {
              console.log(`[Wayback] ⚠️  Primary source ${source} yielded ${headlines.length} headlines (below ideal ${MIN_HEADLINES}, but accepting)`)
            }

            allHeadlines.push(...headlines)
            usedSources.push(source)
            primaryTimestamp = snapshot.timestamp

            // Als primaire bron resultaten heeft, stoppen we hier
            await updateCache(dateParam, {
              status: 'found',
              timestamp: snapshot.timestamp,
              headlines: headlines,  // v2.1.0: Store full headlines!
              headlineCount: headlines.length,
              sources: [source]
            })

            return NextResponse.json({
              date: dateParam,
              headlines: allHeadlines,
              totalHeadlines: allHeadlines.length,
              sources: usedSources,
              sourceUrl: getWaybackUrl(snapshot.timestamp, source),
              snapshotTimestamp: snapshot.timestamp,
              apiVersion: API_VERSION,
              cacheHit: false
            } as WaybackNewsResult)
          }
        }
      }
    }
    
    console.log(`[Wayback] Primary sources yielded no results, trying fallback sources...`)
    
    // STAP 2: Als primaire bron niks heeft, probeer fallback bronnen
    for (const source of NEWS_SOURCES.fallback) {
      const snapshot = await findSnapshot(dateParam, source)
      
      if (snapshot) {
        const html = await fetchSnapshotContent(snapshot.timestamp, source)
        
        if (html) {
          const headlines = parseHeadlines(html, source)
          
          if (headlines.length > 0) {
            console.log(`[Wayback] ✓ Fallback source ${source} yielded ${headlines.length} headlines`)
            allHeadlines.push(...headlines)
            usedSources.push(source)
            
            if (!primaryTimestamp) {
              primaryTimestamp = snapshot.timestamp
            }
          }
        }
      }
    }
    
    // Als we nu wel headlines hebben, return success
    if (allHeadlines.length > 0) {
      console.log(`[Wayback] ✓ Fallback sources yielded ${allHeadlines.length} total headlines`)

      await updateCache(dateParam, {
        status: 'found',
        timestamp: primaryTimestamp || undefined,
        headlines: allHeadlines,  // v2.1.0: Store full headlines!
        headlineCount: allHeadlines.length,
        sources: usedSources
      })

      return NextResponse.json({
        date: dateParam,
        headlines: allHeadlines,
        totalHeadlines: allHeadlines.length,
        sources: usedSources,
        sourceUrl: primaryTimestamp ? getWaybackUrl(primaryTimestamp, usedSources[0]) : '',
        snapshotTimestamp: primaryTimestamp,
        apiVersion: API_VERSION,
        cacheHit: false
      } as WaybackNewsResult)
    }
    
    // Geen enkele bron had resultaten - don't cache, let next user retry
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

    // Don't cache errors - let next user retry (might be temporary Wayback issue)
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