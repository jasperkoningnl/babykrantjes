// app/api/top40/route.ts
// @version 1.0.0
// Server-side scraper voor Top40.nl
// Haalt hitlijst data op basis van datum

import { NextRequest, NextResponse } from 'next/server'

interface ChartEntry {
  position: number
  title: string
  artist: string
  weeksInChart?: number
  previousPosition?: number
}

interface Top40Result {
  numberOne: ChartEntry | null
  topTen: ChartEntry[]
  chartDate: string
  weekNumber: number
  year: number
  source: string
  sourceUrl: string
}

/**
 * GET /api/top40?date=YYYY-MM-DD
 * Haalt de Top 40 op voor de week waarin de datum valt
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Valideer datum
  const date = new Date(dateParam)
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }

  // Check of datum binnen bereik is (Top40 begon 1 jan 1965)
  const minDate = new Date('1965-01-01')
  if (date < minDate) {
    return NextResponse.json(
      { error: 'Date must be after January 1, 1965 (start of Top 40)' },
      { status: 400 }
    )
  }

  try {
    // Bereken weeknummer en jaar
    const weekNumber = getISOWeekNumber(date)
    const year = getISOWeekYear(date)
    
    // Top40.nl URL patroon
    const url = `https://www.top40.nl/top40/${year}/week-${weekNumber}`
    console.log(`[Top40] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 } // Cache 24 uur
    })

    if (!response.ok) {
      console.error(`[Top40] HTTP ${response.status}`)
      return NextResponse.json(
        { error: `Top40.nl returned ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const result = parseTop40Html(html, dateParam, weekNumber, year, url)

    console.log(`[Top40] Found #1: ${result.numberOne?.artist} - ${result.numberOne?.title}`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Top40] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Top 40 data' },
      { status: 500 }
    )
  }
}

/**
 * Parse Top40.nl HTML naar gestructureerde data
 */
function parseTop40Html(
  html: string,
  chartDate: string,
  weekNumber: number,
  year: number,
  sourceUrl: string
): Top40Result {
  const result: Top40Result = {
    numberOne: null,
    topTen: [],
    chartDate,
    weekNumber,
    year,
    source: 'Top40.nl',
    sourceUrl
  }

  try {
    // De Top40.nl pagina heeft list-items met positie, titel en artiest
    // We zoeken naar het patroon in de HTML
    
    // Methode 1: Zoek naar data in JSON-LD of structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    
    // Methode 2: Parse de HTML direct
    // Top40.nl gebruikt een specifieke structuur voor elk nummer
    // <div class="top40-list"> bevat alle items
    
    // Zoek naar individuele entries
    // Patroon: positie + titel + artiest combinaties
    const entries: ChartEntry[] = []
    
    // Regex voor het vinden van chart entries
    // Top40.nl structuur: positienummer gevolgd door titel en artiest
    const entryPattern = /<div[^>]*class="[^"]*list-item[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*position[^"]*"[^>]*>(\d+)<\/span>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi
    
    let match
    while ((match = entryPattern.exec(html)) !== null && entries.length < 10) {
      entries.push({
        position: parseInt(match[1], 10),
        title: decodeHtmlEntities(match[2].trim()),
        artist: decodeHtmlEntities(match[3].trim())
      })
    }

    // Als de regex niet werkt, probeer alternatieve patronen
    if (entries.length === 0) {
      // Alternatief patroon voor nieuwere versie van de site
      const altPattern = /data-position="(\d+)"[\s\S]*?data-title="([^"]+)"[\s\S]*?data-artist="([^"]+)"/gi
      
      while ((match = altPattern.exec(html)) !== null && entries.length < 10) {
        entries.push({
          position: parseInt(match[1], 10),
          title: decodeHtmlEntities(match[2].trim()),
          artist: decodeHtmlEntities(match[3].trim())
        })
      }
    }

    // Als nog steeds niets, probeer de meest basale parsing
    if (entries.length === 0) {
      // Zoek naar combinaties van nummers en titels
      // Dit is een fallback voor als de structuur verandert
      const simplePattern = /<a[^>]*href="[^"]*\/nummer\/[^"]*"[^>]*>[\s\S]*?<span[^>]*>(\d+)<\/span>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/span>/gi
      
      while ((match = simplePattern.exec(html)) !== null && entries.length < 10) {
        entries.push({
          position: parseInt(match[1], 10),
          title: decodeHtmlEntities(match[2].trim()),
          artist: decodeHtmlEntities(match[3].trim())
        })
      }
    }

    // Sorteer op positie en neem top 10
    entries.sort((a, b) => a.position - b.position)
    result.topTen = entries.slice(0, 10)
    result.numberOne = entries.find(e => e.position === 1) || null

    // Als we nog steeds niets hebben, probeer een heel simpele fallback
    if (!result.numberOne) {
      // Zoek naar de eerste duidelijke titel/artiest combinatie
      const titleMatch = html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i)
      const artistMatch = html.match(/<h3[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/h3>/i)
      
      if (titleMatch && artistMatch) {
        result.numberOne = {
          position: 1,
          title: decodeHtmlEntities(titleMatch[1].trim()),
          artist: decodeHtmlEntities(artistMatch[1].trim())
        }
        result.topTen = [result.numberOne]
      }
    }

  } catch (error) {
    console.error('[Top40] Parse error:', error)
  }

  return result
}

/**
 * Berekent ISO weeknummer
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Berekent het jaar voor de ISO week
 * (kan verschillen van kalenderjaar aan begin/eind van jaar)
 */
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}