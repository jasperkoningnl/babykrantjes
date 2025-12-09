// app/api/news/daily/route.ts
// @version 1.0.0
// Wikipedia Current Events scraper voor internationaal nieuws op een specifieke dag
// Bron: https://en.wikipedia.org/wiki/Portal:Current_events/{jaar}_{maand}_{dag}

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface NewsEvent {
  category: string
  text: string
}

interface DailyNewsResult {
  date: string
  events: NewsEvent[]
  totalEvents: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD format

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Parse datum
  const dateParts = dateParam.split('-')
  if (dateParts.length !== 3) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const [yearStr, monthStr, dayStr] = dateParts
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return NextResponse.json(
      { error: 'Invalid date values' },
      { status: 400 }
    )
  }

  const monthName = MONTHS_EN[month - 1]
  const pageTitle = `Portal:Current_events/${year}_${monthName}_${day}`
  const encodedTitle = encodeURIComponent(pageTitle)
  
  // Wikipedia REST API voor schone HTML
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodedTitle}`
  const webUrl = `https://en.wikipedia.org/wiki/${pageTitle.replace(/ /g, '_')}`

  const emptyResult: DailyNewsResult = {
    date: dateParam,
    events: [],
    totalEvents: 0,
    source: 'Wikipedia Portal:Current_events',
    sourceUrl: webUrl,
    apiVersion: API_VERSION
  }

  try {
    console.log(`[NewsDaily] Fetching: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'BabykrantBot/1.0 (educational project)',
        'Accept': 'text/html'
      },
      next: { revalidate: 86400 * 30 } // Cache 30 dagen (historische data)
    })

    if (response.status === 404) {
      console.log(`[NewsDaily] Page not found for ${dateParam}`)
      return NextResponse.json({
        ...emptyResult,
        error: `No news page found for ${dateParam}`
      })
    }

    if (!response.ok) {
      console.error(`[NewsDaily] HTTP ${response.status}`)
      return NextResponse.json({
        ...emptyResult,
        error: `Wikipedia returned ${response.status}`
      })
    }

    const html = await response.text()
    const events = parseCurrentEventsHtml(html)

    console.log(`[NewsDaily] Found ${events.length} events for ${dateParam}`)

    return NextResponse.json({
      date: dateParam,
      events,
      totalEvents: events.length,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: webUrl,
      apiVersion: API_VERSION
    })

  } catch (error) {
    console.error('[NewsDaily] Error:', error)
    return NextResponse.json({
      ...emptyResult,
      error: 'Failed to fetch news data'
    })
  }
}

/**
 * Parset de Wikipedia Current Events HTML
 * Structuur: secties met headers (h2/h3) gevolgd door ul/li lijsten
 */
function parseCurrentEventsHtml(html: string): NewsEvent[] {
  const events: NewsEvent[] = []
  const categoryCount: Record<string, number> = {}
  const MAX_PER_CATEGORY = 5

  try {
    // Bepaal of de pagina veel categorieën heeft
    const headerMatches = html.match(/<h[23][^>]*>/gi) || []
    const hasManyCats = headerMatches.length >= 3
    const maxPerCat = hasManyCats ? MAX_PER_CATEGORY : 25

    let currentCategory = 'General'

    // Splits op secties en headers
    // We zoeken naar h2, h3 headers en ul lijsten

    // Methode 1: Zoek headers en pak de tekst
    const headerPattern = /<h[23][^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/h[23]>/gi
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi

    // Eerst alle headers vinden met hun positie
    const headers: Array<{ pos: number; text: string }> = []
    let headerMatch
    while ((headerMatch = headerPattern.exec(html)) !== null) {
      const headerText = cleanText(headerMatch[1])
      if (headerText && headerText.length > 1 && headerText.length < 100) {
        headers.push({ pos: headerMatch.index, text: headerText })
      }
    }

    // Dan alle list items vinden
    let listMatch
    while ((listMatch = listItemPattern.exec(html)) !== null) {
      const itemPos = listMatch.index
      const itemHtml = listMatch[1]

      // Bepaal huidige categorie op basis van positie
      for (const h of headers) {
        if (h.pos < itemPos) {
          currentCategory = h.text
        }
      }

      // Check of we max voor deze categorie hebben bereikt
      if (!categoryCount[currentCategory]) {
        categoryCount[currentCategory] = 0
      }
      if (categoryCount[currentCategory] >= maxPerCat) {
        continue
      }

      // Parse de tekst uit het list item
      const text = cleanNewsText(itemHtml)

      // Filter: moet substantieel zijn en geen nested list header
      if (text.length > 20 && !text.endsWith(':')) {
        // Check voor duplicaten
        const isDuplicate = events.some(e => e.text === text || text.includes(e.text) || e.text.includes(text))
        
        if (!isDuplicate) {
          events.push({
            category: currentCategory,
            text
          })
          categoryCount[currentCategory]++
        }
      }
    }

    // Fallback: als geen events gevonden, probeer paragraphs
    if (events.length === 0) {
      const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi
      let pMatch
      while ((pMatch = pPattern.exec(html)) !== null && events.length < 15) {
        const text = cleanNewsText(pMatch[1])
        if (text.length > 30) {
          events.push({
            category: 'News',
            text
          })
        }
      }
    }

  } catch (error) {
    console.error('[NewsDaily] Parse error:', error)
  }

  return events
}

/**
 * Verwijdert HTML tags en behoudt alleen tekst
 */
function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reinigt nieuws tekst: verwijdert referenties, extra whitespace, etc.
 */
function cleanNewsText(html: string): string {
  let text = html
    // Verwijder HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Verwijder Wikipedia referenties [1], [2], etc.
    .replace(/\[\d+\]/g, '')
    // Verwijder haakjes met alleen een bron erin
    .replace(/\s*\([^)]*(?:Reuters|AP|BBC|AFP|source)[^)]*\)\s*$/i, '')
    // Normaliseer whitespace
    .replace(/\s+/g, ' ')
    // Verwijder leading/trailing dubbele punt
    .replace(/^[:\s]+/, '')
    .replace(/[:\s]+$/, '')
    .trim()

  // Decode HTML entities
  text = decodeHtmlEntities(text)

  return text
}

/**
 * Decodeert HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}