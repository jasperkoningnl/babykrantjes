// app/api/top40/route.ts
// @version 1.2.0
// Server-side scraper voor Top40.nl
// FIXED: Parsing voor zowel raw HTML als markdown-converted response

import { NextRequest, NextResponse } from 'next/server'

interface ChartEntry {
  position: number
  title: string
  artist: string
  weeksInChart?: number
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  const date = new Date(dateParam)
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const minDate = new Date('1965-01-01')
  if (date < minDate) {
    return NextResponse.json(
      { error: 'Date must be after January 1, 1965' },
      { status: 400 }
    )
  }

  try {
    const weekNumber = getISOWeekNumber(date)
    const year = getISOWeekYear(date)
    const url = `https://www.top40.nl/top40/${year}/week-${weekNumber}`
    
    console.log(`[Top40] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 }
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

    console.log(`[Top40] Found ${result.topTen.length} entries, #1: ${result.numberOne?.artist} - ${result.numberOne?.title}`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Top40] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Top 40 data' },
      { status: 500 }
    )
  }
}

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
    const entries: ChartEntry[] = []

    // De Top40.nl site heeft een specifieke HTML structuur:
    // <a href="/artiest/titel-nummer">
    //   <h2>Titel</h2>
    //   <h3>Artiest</h3>
    // </a>
    // Met positie en weken ergens in de buurt

    // Patroon 1: Zoek naar <h2> titel en <h3> artiest combinaties
    // Deze staan binnen anchor tags naar /artiest/nummer-xxxxx URLs
    const h2h3Pattern = /<a[^>]*href="\/([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi
    
    let match
    while ((match = h2h3Pattern.exec(html)) !== null && entries.length < 40) {
      const title = decodeHtmlEntities(match[2].trim())
      const artist = decodeHtmlEntities(match[3].trim())
      
      // Filter alleen muziek entries (URL bevat artiest-slug/nummer-slug)
      if (title && artist && match[1].includes('/')) {
        entries.push({
          position: entries.length + 1,
          title,
          artist
        })
      }
    }

    // Patroon 2: Als h2/h3 niet werkt, zoek naar class-based structuur
    if (entries.length === 0) {
      // Zoek naar elementen met titel/artiest classes
      const classPattern = /<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\//gi
      
      while ((match = classPattern.exec(html)) !== null && entries.length < 40) {
        const title = decodeHtmlEntities(match[1].trim())
        const artist = decodeHtmlEntities(match[2].trim())
        
        if (title && artist) {
          entries.push({
            position: entries.length + 1,
            title,
            artist
          })
        }
      }
    }

    // Patroon 3: Zoek naar data attributen
    if (entries.length === 0) {
      const dataPattern = /data-title="([^"]+)"[\s\S]*?data-artist="([^"]+)"/gi
      
      while ((match = dataPattern.exec(html)) !== null && entries.length < 40) {
        entries.push({
          position: entries.length + 1,
          title: decodeHtmlEntities(match[1].trim()),
          artist: decodeHtmlEntities(match[2].trim())
        })
      }
    }

    // Patroon 4: Zoek naar specifieke link structuur met titel in URL
    if (entries.length === 0) {
      // URLs zijn in format: /artiest-slug/titel-slug-nummer
      // Bijv: /antoon-2/hallo-1-38721
      const urlPattern = /href="\/([a-z0-9-]+)\/([a-z0-9-]+)-\d+-(\d+)"/gi
      const seenIds = new Set<string>()
      
      while ((match = urlPattern.exec(html)) !== null && entries.length < 40) {
        const id = match[3]
        if (!seenIds.has(id)) {
          seenIds.add(id)
          // Artiest en titel uit URL halen als fallback
          const artistSlug = match[1].replace(/-\d+$/, '').replace(/-/g, ' ')
          const titleSlug = match[2].replace(/-\d+$/, '').replace(/-/g, ' ')
          
          entries.push({
            position: entries.length + 1,
            title: capitalizeWords(titleSlug),
            artist: capitalizeWords(artistSlug)
          })
        }
      }
    }

    // Patroon 5: Directe text matching voor markdown-geconverteerde content
    if (entries.length === 0) {
      // Als de content als markdown is (bijv van web_fetch)
      // Format: [## Titel](url)\n[### Artiest](url)
      const mdPattern = /\[## ([^\]]+)\]\([^)]+\)[\s\S]*?\[### ([^\]]+)\]\([^)]+\)/g
      
      while ((match = mdPattern.exec(html)) !== null && entries.length < 40) {
        const title = decodeHtmlEntities(match[1].trim())
        const artist = decodeHtmlEntities(match[2].trim())
        
        if (title && artist && !title.includes('Top 40')) {
          entries.push({
            position: entries.length + 1,
            title,
            artist
          })
        }
      }
    }

    // Zoek weken in chart info
    const weeksPattern = /(\d+)\s*weken?/gi
    let weeksMatch
    let weeksIndex = 0
    while ((weeksMatch = weeksPattern.exec(html)) !== null && weeksIndex < entries.length) {
      if (entries[weeksIndex]) {
        entries[weeksIndex].weeksInChart = parseInt(weeksMatch[1], 10)
      }
      weeksIndex++
    }

    result.topTen = entries.slice(0, 10)
    result.numberOne = entries.length > 0 ? entries[0] : null

  } catch (error) {
    console.error('[Top40] Parse error:', error)
  }

  return result
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

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

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}