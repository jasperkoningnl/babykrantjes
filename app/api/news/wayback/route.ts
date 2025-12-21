// app/api/news/wayback/route.ts
// @version 1.6.0
// Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
// Bronnen: www.nu.nl (primair), www.nos.nl + nos.nl (fallback)
// UPDATE v1.2.0: Multi-source fallback toegevoegd
// UPDATE v1.3.0: Fix cache update in error scenarios + stale cache retry logic
// UPDATE v1.4.0: Cache full headlines for true performance gain
// UPDATE v1.5.0: Simplified - only cache success (prevents overwrite issues)
// UPDATE v1.6.0: Timeout & retry logic + smart CDX strategy + minimum threshold

import { NextRequest, NextResponse } from 'next/server'
import { checkCache, updateCache, type WaybackHeadline } from '@/lib/waybackCache'
import { fetchWithRetry } from '@/lib/waybackFetch'

const API_VERSION = '1.6.0'

// Reliability settings
const MIN_HEADLINES = 10  // Minimum number of headlines to accept as valid result
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
 */
async function findSnapshot(date: string, source: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`

  // CDX API: fetch more snapshots for better selection
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${source}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=${CDX_LIMIT}`

  console.log(`[Wayback] CDX query [${source}]: ${cdxUrl}`)

  try {
    const response = await fetchWithRetry(cdxUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project)'
      }
    })

    if (!response.ok) {
      console.error(`[Wayback] CDX API error [${source}]: ${response.status}`)
      return null
    }

    const data = await response.json() as CDXRecord[]

    // Eerste rij is header, daarna data
    if (data.length < 2) {
      console.log(`[Wayback] No snapshots found for ${source} on ${date}`)
      return null
    }

    // Smart selection: prefer snapshots during peak news hours
    const snapshots = data.slice(1).map(record => {
      const [urlkey, timestamp, original, mimetype, statuscode, digest, length] = record
      const hour = parseInt(timestamp.substring(8, 10))

      // Score based on time of day
      // Peak news hours (12:00-20:00): score 10
      // Morning (08:00-12:00): score 5
      // Night/early morning: score 1
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

    // Sort by score (highest first) and pick best
    snapshots.sort((a, b) => b.score - a.score)
    const best = snapshots[0]

    console.log(`[Wayback] Selected snapshot at ${best.hour}:${best.timestamp.substring(10, 12)} (score: ${best.score}, ${snapshots.length} total snapshots)`)

    return {
      timestamp: best.timestamp,
      url: best.url,
      status: best.status,
      mimeType: best.mimeType,
      source
    }
  } catch (error) {
    console.error(`[Wayback] CDX fetch error [${source}]:`, error)
    return null
  }
}

/**
 * Haalt de HTML content van een Wayback snapshot op
 * v1.6.0: Uses fetchWithRetry for better reliability
 */
async function fetchSnapshotContent(timestamp: string, source: string): Promise<string | null> {
  // Wayback URL format: https://web.archive.org/web/{timestamp}/https://{source}/
  const protocol = source.startsWith('www.') ? 'https://www.' : 'https://'
  const domain = source.replace(/^www\./, '')
  const waybackUrl = `https://web.archive.org/web/${timestamp}/${protocol}${domain}/`

  console.log(`[Wayback] Fetching [${source}]: ${waybackUrl}`)

  try {
    const response = await fetchWithRetry(waybackUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project)',
        'Accept': 'text/html'
      }
    })

    if (!response.ok) {
      console.error(`[Wayback] Fetch error [${source}]: ${response.status}`)
      return null
    }

    return await response.text()
  } catch (error) {
    console.error(`[Wayback] Content fetch error [${source}]:`, error)
    return null
  }
}

/**
 * Parseert headlines uit nu.nl HTML content
 * Headlines zitten in <span class="item-title__title"> tags
 */
function parseNuNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()
  
  // Patroon 1: item-title__title spans met title attribuut
  // <span title="RIVM meldt opnieuw zeer klein aantal doden" class="item-title__title">
  const titleAttrPattern = /<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi
  
  // Patroon 2: item-title__title spans met content erin
  // <span class="item-title__title"><!----> Headline text </span>
  const spanContentPattern = /<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)\s*<\/span>/gi
  
  // Patroon 3: Links met href en title
  // <a href="/web/20200518.../artikel.html" ... title="Headline">
  const linkPattern = /<a[^>]*href="([^"]*\/nu\.nl\/[^"]+\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)/gi
  
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
  
  // Extract tijd uit de HTML context (item-datetime)
  const extractTime = (context: string): string | null => {
    const timeMatch = context.match(/<time[^>]*class="item-datetime"[^>]*>(\d{1,2}:\d{2})<\/time>/i)
    return timeMatch ? timeMatch[1] : null
  }
  
  // Methode 1: Zoek title attributes
  let match
  while ((match = titleAttrPattern.exec(html)) !== null) {
    const title = decodeHtmlEntities(match[1].trim())
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: '',
        category: null,
        time: null,
        source
      })
    }
  }
  
  // Methode 2: Zoek links met headlines
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1]
    let title = decodeHtmlEntities(match[2].trim())
    
    // Clean up title
    title = title.replace(/^(Video|Podcast|Liveblog[^:]*:?)\s*/i, '').trim()
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      
      // Extract original URL from wayback URL
      const originalUrlMatch = url.match(/\/web\/\d+\/(.+)/)
      const originalUrl = originalUrlMatch ? 'https://' + originalUrlMatch[1].replace(/^https?:\/\//, '') : url
      
      headlines.push({
        title,
        url: originalUrl,
        category: extractCategory(url),
        time: null,
        source
      })
    }
  }
  
  // Methode 3: Span content (fallback)
  while ((match = spanContentPattern.exec(html)) !== null) {
    let title = decodeHtmlEntities(match[1].trim())
    title = title.replace(/^(Video|Podcast|Liveblog[^:]*:?)\s*/i, '').trim()
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: '',
        category: null,
        time: null,
        source
      })
    }
  }
  
  console.log(`[Wayback] Parsed ${headlines.length} unique headlines from ${source}`)
  
  return headlines
}

/**
 * Parseert headlines uit nos.nl HTML content
 * NOS.nl gebruikt een andere HTML structuur dan NU.nl
 */
function parseNosNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()
  
  // Patroon 1: Top story
  // <div class="top-story item click"> ... <strong><a href="...">HEADLINE</a></strong>
  const topStoryPattern = /<div[^>]*class="[^"]*top-story[^"]*"[^>]*>[\s\S]*?<strong>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/strong>/gi
  
  // Patroon 2: Headlines in featured section (img-list)
  // <a href="...">HEADLINE</a> binnen <li class="big">
  const featuredPattern = /<li[^>]*class="[^"]*big[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  
  // Patroon 3: Category headlines
  // <a href="..." title="HEADLINE">HEADLINE</a> binnen <li class="click">
  const categoryPattern = /<li[^>]*class="[^"]*click[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi
  
  // Patroon 4: Laatste nieuws lijst
  // <span class="time">HH:MM</span> <strong>HEADLINE</strong> binnen <a href="...">
  const latestPattern = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="time"[^>]*>(\d{1,2}:\d{2})<\/span>[\s\S]*?<strong>([^<]+)<\/strong>/gi
  
  // Extract categorie uit URL: /nieuws/binnenland/, /sport/, etc.
  const extractCategory = (url: string): string | null => {
    const match = url.match(/nos\.nl\/(nieuws\/)?([a-z-]+)\//)
    if (match && match[2]) {
      const cat = match[2]
      // Filter non-news categories
      if (['artikel', 'video', 'audio', 'uitzending'].includes(cat)) return null
      // Capitalize
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
  
  let match
  
  // Extract top story
  while ((match = topStoryPattern.exec(html)) !== null) {
    const url = match[1]
    const title = decodeHtmlEntities(match[2].trim())
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: cleanWaybackUrl(url),
        category: 'Top Story',
        time: null,
        source
      })
    }
  }
  
  // Extract featured headlines
  while ((match = featuredPattern.exec(html)) !== null) {
    const url = match[1]
    const title = decodeHtmlEntities(match[2].trim())
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: cleanWaybackUrl(url),
        category: extractCategory(url),
        time: null,
        source
      })
    }
  }
  
  // Extract category headlines
  while ((match = categoryPattern.exec(html)) !== null) {
    const url = match[1]
    const title = decodeHtmlEntities(match[2].trim())
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: cleanWaybackUrl(url),
        category: extractCategory(url),
        time: null,
        source
      })
    }
  }
  
  // Extract latest news with timestamps
  while ((match = latestPattern.exec(html)) !== null) {
    const url = match[1]
    const titleAttr = match[2]
    const time = match[3]
    const titleStrong = match[4]
    
    // Prefer title from strong tag, fallback to title attribute
    const title = decodeHtmlEntities((titleStrong || titleAttr).trim())
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      headlines.push({
        title,
        url: cleanWaybackUrl(url),
        category: extractCategory(url),
        time,
        source
      })
    }
  }
  
  console.log(`[Wayback] Parsed ${headlines.length} unique headlines from ${source}`)
  
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

          // v1.6.0: Apply minimum threshold to ensure quality results
          if (headlines.length >= MIN_HEADLINES) {
            console.log(`[Wayback] ✓ Primary source ${source} yielded ${headlines.length} headlines (threshold: ${MIN_HEADLINES})`)
            allHeadlines.push(...headlines)
            usedSources.push(source)
            primaryTimestamp = snapshot.timestamp

            // Als primaire bron voldoende resultaten heeft, stoppen we hier
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
          } else if (headlines.length > 0) {
            console.log(`[Wayback] ⚠️  Primary source ${source} yielded only ${headlines.length} headlines (below threshold ${MIN_HEADLINES}), trying fallback...`)
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
      // v1.6.0: Log if result is below ideal threshold but still returned
      if (allHeadlines.length < MIN_HEADLINES) {
        console.log(`[Wayback] ⚠️  Returning ${allHeadlines.length} headlines (below ideal threshold of ${MIN_HEADLINES}, but best available)`)
      }

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