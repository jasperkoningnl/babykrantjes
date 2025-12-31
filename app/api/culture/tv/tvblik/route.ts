// app/api/culture/tv/tvblik/route.ts
// @version 1.0.0
// LIVE scraper voor tvblik.nl (laatste 7 dagen)
// Haalt TV programma's op per dag via /web2/getguide/ endpoint

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

export interface TvblikProgram {
  title: string
  episodeTitle: string | null
  description: string | null  // Altijd null - tvblik.nl heeft geen descriptions in guide
  broadcaster: string | null
  channel: string | null
  imageUrl: string | null      // Altijd null - tvblik.nl heeft geen images in guide
  sourceUrl: string | null
  time: string | null           // Uitzendtijd (HH:MM)
  ranking: number | null        // Niet beschikbaar bij tvblik.nl
  viewerCount: number | null    // Niet beschikbaar bij tvblik.nl
  viewerShare: number | null    // Niet beschikbaar bij tvblik.nl
}

export interface TvblikResult {
  programs: TvblikProgram[]
  date: string
  totalFound: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
}

/**
 * Berekent aantal dagen terug voor tvblik.nl op basis van datum
 * De site gebruikt /web2/getguide/{daysBack} waarbij:
 * - 0 = vandaag
 * - 1 = gisteren
 * - 2 = eergisteren
 * - etc. (tot 7 dagen terug)
 */
function calculateDaysBack(dateString: string): number {
  const targetDate = new Date(dateString)
  const today = new Date()

  // Zet beide datums op midnight voor correcte vergelijking
  targetDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Extraheert de datum uit de tvblik HTML
 * Zoekt naar actieve tab met class=active
 * Formaat: <li class=active><a ...><span>30 december</span></a></li>
 * Year wordt geëxtraheerd uit URLs in de pagina (bijv. /programma/30-december-2025)
 * Returns: YYYY-MM-DD formaat of null als niet gevonden
 */
function extractDateFromHTML(html: string): string | null {
  try {
    // Zoek naar actieve tab
    const activeTabMatch = html.match(/<li\s+class=active>.*?<span>(\d+)\s+(\w+)<\/span>/i)
    if (!activeTabMatch) return null

    const [, day, monthName] = activeTabMatch

    // Extract year from any URL in the page (bijv. /programma/30-december-2025)
    const yearMatch = html.match(/\/(\d+)-december-(\d{4})/)
    if (!yearMatch) {
      // Fallback: gebruik huidig jaar
      const currentYear = new Date().getFullYear()
      return formatDate(day, monthName, currentYear.toString())
    }

    const year = yearMatch[2]
    return formatDate(day, monthName, year)

  } catch {
    return null
  }
}

/**
 * Converteert Nederlandse datum naar YYYY-MM-DD
 */
function formatDate(day: string, monthName: string, year: string): string | null {
  // Nederlandse maanden mapping
  const months: Record<string, string> = {
    'januari': '01', 'februari': '02', 'maart': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'augustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'december': '12'
  }

  const month = months[monthName.toLowerCase()]
  if (!month) return null

  const paddedDay = day.padStart(2, '0')
  return `${year}-${month}-${paddedDay}`
}

/**
 * Parseert TV programma's van tvblik.nl
 * Structuur:
 * <div class="guideItem" id="channelN">
 *   <div class="h-title"><a ...><h2>CHANNEL_NAME</h2></a></div>
 *   <ul class="scrollWindow">
 *     <li><a href="..."><span class="title"><span>HH:MM</span> PROGRAM_TITLE</span></a></li>
 *   </ul>
 * </div>
 */
function parseTvblikGuide(html: string, dateString: string): TvblikProgram[] {
  const programs: TvblikProgram[] = []

  try {
    // Split op guideItem om per zender te parsen
    const channelBlocks = html.split(/<div[^>]*class="[^"]*guideItem[^"]*"/)

    for (let i = 1; i < channelBlocks.length; i++) {
      const block = channelBlocks[i]

      // Extract zendernaam uit h-title > h2
      const channelMatch = block.match(/<div[^>]*class="[^"]*h-title[^"]*"[^>]*>.*?<h2>([^<]+)<\/h2>/i)
      if (!channelMatch) continue

      const channel = cleanText(channelMatch[1])

      // Extract alle programma's uit deze zender
      const programRegex = /<li[^>]*><a[^>]*><span[^>]*class="[^"]*title[^"]*"[^>]*><span[^>]*>(\d{2}:\d{2})<\/span>\s*([^<]+)<\/span>/gi

      let programMatch
      while ((programMatch = programRegex.exec(block)) !== null) {
        const [, time, title] = programMatch

        if (!time || !title) continue

        programs.push({
          title: cleanText(title),
          episodeTitle: null,  // tvblik.nl heeft geen episode info in guide
          description: null,   // tvblik.nl heeft geen descriptions in guide
          broadcaster: null,   // tvblik.nl toont alleen zender
          channel,
          imageUrl: null,      // tvblik.nl heeft geen images in guide
          sourceUrl: null,
          time: time.trim(),
          ranking: null,       // tvblik.nl heeft geen ranking
          viewerCount: null,   // tvblik.nl heeft geen kijkcijfers
          viewerShare: null    // tvblik.nl heeft geen marktaandeel
        })
      }
    }

    console.log(`[Tvblik] Parsed ${programs.length} programs from guide`)

  } catch (error) {
    console.error('[Tvblik] Parse error:', error)
  }

  return programs
}

/**
 * Ruimt tekst op
 */
function cleanText(text: string): string {
  return text
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
}

/**
 * Valideert of de datum binnen het beschikbare bereik valt
 * tvblik.nl heeft data van vandaag tot ~7 dagen geleden
 */
function isDateInRange(dateString: string): { valid: boolean; daysBack: number; error?: string } {
  const daysBack = calculateDaysBack(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(dateString)
  targetDate.setHours(0, 0, 0, 0)

  // Te ver in de toekomst
  if (daysBack < 0) {
    return {
      valid: false,
      daysBack,
      error: 'Date is in the future'
    }
  }

  // Te ver in het verleden (tvblik.nl heeft max ~7 dagen)
  if (daysBack > 7) {
    return {
      valid: false,
      daysBack,
      error: `Date is too old. tvblik.nl has data up to ~7 days ago. Requested date is ${daysBack} days ago.`
    }
  }

  return { valid: true, daysBack }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD format

  console.log(`[Tvblik API v${API_VERSION}] Request for date: ${dateParam}`)

  if (!dateParam) {
    return NextResponse.json({
      programs: [],
      date: '',
      totalFound: 0,
      source: 'tvblik.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'Missing required parameter: date (YYYY-MM-DD)'
    } as TvblikResult, { status: 400 })
  }

  // Valideer datum formaat
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateParam)) {
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'tvblik.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'Invalid date format. Use YYYY-MM-DD'
    } as TvblikResult, { status: 400 })
  }

  // Valideer datum bereik
  const rangeCheck = isDateInRange(dateParam)
  if (!rangeCheck.valid) {
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'tvblik.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: rangeCheck.error
    } as TvblikResult, { status: 400 })
  }

  const daysBack = rangeCheck.daysBack
  const url = `https://tvblik.nl/web2/getguide/${daysBack}`

  console.log(`[Tvblik] Fetching: ${url} (${daysBack} days back)`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      next: { revalidate: 86400 } // Cache 1 dag (data kan nog veranderen)
    })

    if (!response.ok) {
      console.error(`[Tvblik] HTTP ${response.status}`)
      return NextResponse.json({
        programs: [],
        date: dateParam,
        totalFound: 0,
        source: 'tvblik.nl',
        sourceUrl: url,
        apiVersion: API_VERSION,
        error: `No data found for ${dateParam} (HTTP ${response.status})`
      } as TvblikResult)
    }

    const html = await response.text()

    // Extract en valideer de datum uit de HTML
    const actualDate = extractDateFromHTML(html)

    if (!actualDate) {
      console.error(`[Tvblik] Could not extract date from HTML for ${dateParam}`)
      return NextResponse.json({
        programs: [],
        date: dateParam,
        totalFound: 0,
        source: 'tvblik.nl',
        sourceUrl: url,
        apiVersion: API_VERSION,
        error: `Could not extract date from HTML. Data might not be available.`
      } as TvblikResult)
    }

    // Controleer of de datum overeenkomt met wat we verwachten
    if (actualDate !== dateParam) {
      console.warn(`[Tvblik] Date mismatch: requested ${dateParam}, got ${actualDate}`)
      return NextResponse.json({
        programs: [],
        date: dateParam,
        totalFound: 0,
        source: 'tvblik.nl',
        sourceUrl: url,
        apiVersion: API_VERSION,
        error: `Data not available for ${dateParam}. Most recent data is from ${actualDate}`
      } as TvblikResult)
    }

    const programs = parseTvblikGuide(html, dateParam)

    console.log(`[Tvblik] Found ${programs.length} programs for ${dateParam} (date validated)`)

    return NextResponse.json({
      programs,
      date: dateParam,
      totalFound: programs.length,
      source: 'tvblik.nl',
      sourceUrl: url,
      apiVersion: API_VERSION
    } as TvblikResult)

  } catch (error) {
    console.error('[Tvblik] Error:', error)
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'tvblik.nl',
      sourceUrl: url,
      apiVersion: API_VERSION,
      error: error instanceof Error ? error.message : 'Failed to fetch TV data'
    } as TvblikResult, { status: 500 })
  }
}
