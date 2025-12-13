// app/api/news/wayback/route.ts
// @version 1.2.0
// Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
// Bronnen: www.nu.nl (primair), www.nos.nl + nos.nl (fallback)
// UPDATE v1.2.0: Multi-source fallback toegevoegd

import { NextRequest, NextResponse } from 'next/server'
import { checkCache, updateCache } from '@/lib/waybackCache'

const API_VERSION = '1.2.0'

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

interface Headline {
  title: string
  url: string
  category: string | null
  time: string | null
  source: string
}

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
 * Zoekt een snapshot van een specifieke bron op een specifieke datum via CDX API
 */
async function findSnapshot(date: string, source: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`
  
  // CDX API: zoek snapshots van de bron op deze datum
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${source}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=5`
  
  console.log(`[Wayback] CDX query [${source}]: ${cdxUrl}`)
  
  try {
    const response = await fetch(cdxUrl, {
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
    
    // Neem de eerste geldige snapshot (skip header rij)
    const record = data[1]
    const [urlkey, timestamp, original, mimetype, statuscode, digest, length] = record
    
    console.log(`[Wayback] Found snapshot [${source}]: timestamp=${timestamp}, status=${statuscode}`)
    
    return {
      timestamp,
      url: original,
      status: statuscode,
      mimeType: mimetype,
      source
    }
  } catch (error) {
    console.error(`[Wayback] CDX fetch error [${source}]:`, error)
    return null
  }
}

/**
 * Haalt de HTML content van een Wayback snapshot op
 */
async function fetchSnapshotContent(timestamp: string, source: string): Promise<string | null> {
  // Wayback URL format: https://web.archive.org/web/{timestamp}/https://{source}/
  const protocol = source.startsWith('www.') ? 'https://www.' : 'https://'
  const domain = source.replace(/^www\./, '')
  const waybackUrl = `https://web.archive.org/web/${timestamp}/${protocol}${domain}/`
  
  console.log(`[Wayback] Fetching [${source}]: ${waybackUrl}`)
  
  try {
    const response = await fetch(waybackUrl, {
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
 * NOS.nl gebruikt een andere HTML structuur
 */
function parseNosNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()
  
  // NOS.nl patronen:
  // <h2>Headline text</h2>
  // <h3>Headline text</h3>
  // <a href="/artikel/...">Headline</a>
  
  const h2Pattern = /<h2[^>]*>(.*?)<\/h2>/gi
  const h3Pattern = /<h3[^>]*>(.*?)<\/h3>/gi
  const linkPattern = /<a[^>]*href="([^"]*\/artikel\/[^"]+)"[^>]*>(.*?)<\/a>/gi
  
  // Clean HTML tags from text
  const cleanHtml = (text: string): string => {
    return text.replace(/<[^>]+>/g, '').trim()
  }
  
  // Extract h2 headlines
  let match
  while ((match = h2Pattern.exec(html)) !== null) {
    const title = decodeHtmlEntities(cleanHtml(match[1]))
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
  
  // Extract h3 headlines
  while ((match = h3Pattern.exec(html)) !== null) {
    const title = decodeHtmlEntities(cleanHtml(match[1]))
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
  
  // Extract link headlines
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1]
    const title = decodeHtmlEntities(cleanHtml(match[2]))
    
    if (title && title.length > 10 && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase())
      
      // Extract original URL from wayback URL
      const originalUrlMatch = url.match(/\/web\/\d+\/(.+)/)
      const originalUrl = originalUrlMatch ? 'https://' + originalUrlMatch[1].replace(/^https?:\/\//, '') : url
      
      headlines.push({
        title,
        url: originalUrl,
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
    // Update cache voor te oude datums
    await updateCache(dateParam, {
      status: 'too_old',
      reason: 'News archives available from 2005 onwards. Earlier dates may have limited or no snapshots.'
    })
    
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
    
    if (cached) {
      console.log(`[Wayback] Cache hit for ${dateParam}: ${cached.status}`)
      
      if (cached.status === 'not_found' || cached.status === 'too_old') {
        return NextResponse.json({
          date: dateParam,
          headlines: [],
          totalHeadlines: 0,
          sources: [],
          sourceUrl: '',
          snapshotTimestamp: null,
          apiVersion: API_VERSION,
          cacheHit: true,
          error: cached.reason || `No archived snapshot found for ${dateParam}`
        } as WaybackNewsResult)
      }
      
      // Cache hit with found snapshot - we need to re-fetch because we now support multiple sources
      // In a future version, we could store headlines in cache
      if (cached.timestamp) {
        console.log(`[Wayback] Cache indicates snapshots exist, but re-querying for multi-source support`)
      }
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
          
          if (headlines.length > 0) {
            console.log(`[Wayback] ✓ Primary source ${source} yielded ${headlines.length} headlines`)
            allHeadlines.push(...headlines)
            usedSources.push(source)
            primaryTimestamp = snapshot.timestamp
            
            // Als primaire bron resultaten heeft, stoppen we hier
            await updateCache(dateParam, {
              status: 'found',
              timestamp: snapshot.timestamp,
              headlines: headlines.length
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
      await updateCache(dateParam, {
        status: 'found',
        timestamp: primaryTimestamp || undefined,
        headlines: allHeadlines.length
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
    
    // Geen enkele bron had resultaten
    await updateCache(dateParam, {
      status: 'not_found',
      reason: `No archived snapshots found for ${dateParam} across all sources (${[...NEWS_SOURCES.primary, ...NEWS_SOURCES.fallback].join(', ')})`
    })
    
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