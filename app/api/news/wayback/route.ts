// app/api/news/wayback/route.ts
// @version 1.0.0
// Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
// Bron: Gearchiveerde snapshots van nu.nl

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

// Types
interface WaybackSnapshot {
  timestamp: string
  url: string
  status: string
  mimeType: string
}

interface Headline {
  title: string
  url: string
  category: string | null
  time: string | null
}

interface WaybackNewsResult {
  date: string
  headlines: Headline[]
  totalHeadlines: number
  source: string
  sourceUrl: string
  snapshotTimestamp: string | null
  apiVersion: string
  error?: string
}

// CDX API response format: [urlkey, timestamp, original, mimetype, statuscode, digest, length]
type CDXRecord = [string, string, string, string, string, string, string]

/**
 * Zoekt een snapshot van nu.nl op een specifieke datum via CDX API
 */
async function findSnapshot(date: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`
  
  // CDX API: zoek snapshots van nu.nl op deze datum
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=www.nu.nl&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=5`
  
  console.log(`[Wayback] CDX query: ${cdxUrl}`)
  
  try {
    const response = await fetch(cdxUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project)'
      }
    })
    
    if (!response.ok) {
      console.error(`[Wayback] CDX API error: ${response.status}`)
      return null
    }
    
    const data = await response.json() as CDXRecord[]
    
    // Eerste rij is header, daarna data
    if (data.length < 2) {
      console.log(`[Wayback] No snapshots found for ${date}`)
      return null
    }
    
    // Neem de eerste geldige snapshot (skip header rij)
    const record = data[1]
    const [urlkey, timestamp, original, mimetype, statuscode, digest, length] = record
    
    console.log(`[Wayback] Found snapshot: timestamp=${timestamp}, status=${statuscode}`)
    
    return {
      timestamp,
      url: original,
      status: statuscode,
      mimeType: mimetype
    }
  } catch (error) {
    console.error(`[Wayback] CDX fetch error:`, error)
    return null
  }
}

/**
 * Haalt de HTML content van een Wayback snapshot op
 */
async function fetchSnapshotContent(timestamp: string): Promise<string | null> {
  // Wayback URL format: https://web.archive.org/web/{timestamp}/https://www.nu.nl/
  const waybackUrl = `https://web.archive.org/web/${timestamp}/https://www.nu.nl/`
  
  console.log(`[Wayback] Fetching: ${waybackUrl}`)
  
  try {
    const response = await fetch(waybackUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project)',
        'Accept': 'text/html'
      }
    })
    
    if (!response.ok) {
      console.error(`[Wayback] Fetch error: ${response.status}`)
      return null
    }
    
    return await response.text()
  } catch (error) {
    console.error(`[Wayback] Content fetch error:`, error)
    return null
  }
}

/**
 * Parseert headlines uit nu.nl HTML content
 * Headlines zitten in <span class="item-title__title"> tags
 */
function parseHeadlines(html: string): Headline[] {
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
        time: null
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
        time: null
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
        time: null
      })
    }
  }
  
  console.log(`[Wayback] Parsed ${headlines.length} unique headlines`)
  
  return headlines
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
function getWaybackUrl(timestamp: string): string {
  return `https://web.archive.org/web/${timestamp}/https://www.nu.nl/`
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
      source: 'NU.nl via Internet Archive',
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
      source: 'NU.nl via Internet Archive',
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
      source: 'NU.nl via Internet Archive',
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
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      source: 'NU.nl via Internet Archive',
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: 'News archives available from 2005 onwards. Earlier dates may have limited or no snapshots.'
    } as WaybackNewsResult)
  }
  
  try {
    // Stap 1: Zoek een snapshot op deze datum
    const snapshot = await findSnapshot(dateParam)
    
    if (!snapshot) {
      return NextResponse.json({
        date: dateParam,
        headlines: [],
        totalHeadlines: 0,
        source: 'NU.nl via Internet Archive',
        sourceUrl: '',
        snapshotTimestamp: null,
        apiVersion: API_VERSION,
        error: `No archived snapshot found for ${dateParam}. The Wayback Machine may not have captured this date.`
      } as WaybackNewsResult)
    }
    
    // Stap 2: Haal de HTML content op
    const html = await fetchSnapshotContent(snapshot.timestamp)
    
    if (!html) {
      return NextResponse.json({
        date: dateParam,
        headlines: [],
        totalHeadlines: 0,
        source: 'NU.nl via Internet Archive',
        sourceUrl: getWaybackUrl(snapshot.timestamp),
        snapshotTimestamp: snapshot.timestamp,
        apiVersion: API_VERSION,
        error: 'Failed to fetch archived page content'
      } as WaybackNewsResult)
    }
    
    // Stap 3: Parse headlines uit de HTML
    const headlines = parseHeadlines(html)
    
    return NextResponse.json({
      date: dateParam,
      headlines,
      totalHeadlines: headlines.length,
      source: 'NU.nl via Internet Archive',
      sourceUrl: getWaybackUrl(snapshot.timestamp),
      snapshotTimestamp: snapshot.timestamp,
      apiVersion: API_VERSION
    } as WaybackNewsResult)
    
  } catch (error) {
    console.error(`[Wayback News API] Error:`, error)
    
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      source: 'NU.nl via Internet Archive',
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: API_VERSION,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as WaybackNewsResult, { status: 500 })
  }
}