// app/api/dutchcharts/year/route.ts
// @version 1.1.0
// Server-side scraper voor DutchCharts.nl jaaroverzichten
// FIXED: Correcte kolom parsing - kolommen zijn: #, W, P, Artiest, Titel, Label, %

import { NextRequest, NextResponse } from 'next/server'

interface YearChartEntry {
  position: number
  title: string
  artist: string
  weeksInChart?: number
  peakPosition?: number
  label?: string
}

interface DutchChartsYearResult {
  entries: YearChartEntry[]
  year: number
  totalEntries: number
  source: string
  sourceUrl: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const yearParam = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  if (!yearParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: year' },
      { status: 400 }
    )
  }

  const year = parseInt(yearParam, 10)
  
  if (year < 1956 || year > new Date().getFullYear()) {
    return NextResponse.json(
      { error: 'Year must be between 1956 and current year' },
      { status: 400 }
    )
  }

  try {
    const url = `https://dutchcharts.nl/jaaroverzichten.asp?year=${year}&cat=s`
    console.log(`[DutchCharts] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 }
    })

    if (!response.ok) {
      console.error(`[DutchCharts] HTTP ${response.status}`)
      return NextResponse.json(
        { error: `DutchCharts.nl returned ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const result = parseDutchChartsYearHtml(html, year, limit, url)

    console.log(`[DutchCharts] Found ${result.totalEntries} entries for ${year}`)
    if (result.entries.length > 0) {
      console.log(`[DutchCharts] #1: ${result.entries[0].artist} - ${result.entries[0].title}`)
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('[DutchCharts] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DutchCharts data' },
      { status: 500 }
    )
  }
}

function parseDutchChartsYearHtml(
  html: string,
  year: number,
  limit: number,
  sourceUrl: string
): DutchChartsYearResult {
  const result: DutchChartsYearResult = {
    entries: [],
    year,
    totalEntries: 0,
    source: 'DutchCharts.nl',
    sourceUrl
  }

  try {
    const entries: YearChartEntry[] = []

    // DutchCharts tabel structuur:
    // | # | W | P | [lege] | Artiest | Titel | Label | % |
    // Waarbij:
    // # = jaarlijkse positie
    // W = weken in lijst
    // P = piek positie
    // Artiest en Titel zijn links
    
    // De HTML is een tabel, we zoeken naar rijen met links naar showitem.asp
    // Format: <a href="showitem.asp?interpret=...&titel=...">Artiest/Titel</a>
    
    // Patroon: zoek naar rijen die beginnen met een positienummer
    // gevolgd door artiest en titel links
    
    // Methode 1: Zoek naar tabel rijen met het juiste patroon
    // De eerste cel bevat de positie (bold), dan W, P, en dan artiest/titel links
    const rowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*><b>(\d+)<\/b><\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<a[^>]*interpret=([^&"]+)[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*titel=([^&"]+)[^>]*>([^<]+)<\/a>/gi

    let match
    while ((match = rowPattern.exec(html)) !== null && entries.length < limit) {
      const position = parseInt(match[1], 10)
      const weeksInChart = parseInt(match[2], 10)
      const peakPosition = parseInt(match[3], 10)
      const artist = decodeHtmlEntities(decodeURIComponent(match[5].replace(/\+/g, ' ').trim()))
      const title = decodeHtmlEntities(decodeURIComponent(match[7].replace(/\+/g, ' ').trim()))
      
      if (position > 0 && title && artist) {
        entries.push({
          position,
          title,
          artist,
          weeksInChart,
          peakPosition
        })
      }
    }

    // Methode 2: Alternatief patroon als eerste niet werkt
    if (entries.length === 0) {
      // Zoek naar alle showitem links en reconstrueer de data
      const linkPattern = /<a[^>]*href="showitem\.asp\?interpret=([^&"]+)&(?:amp;)?titel=([^&"]+)&(?:amp;)?cat=s"[^>]*>([^<]+)<\/a>/gi
      const artistTitlePairs: Array<{artist: string, title: string, displayArtist: string, displayTitle: string}> = []
      
      while ((match = linkPattern.exec(html)) !== null) {
        const interpretEncoded = match[1]
        const titelEncoded = match[2]
        const displayText = match[3].trim()
        
        // Decode URL parameters
        const artist = decodeURIComponent(interpretEncoded.replace(/\+/g, ' '))
        const title = decodeURIComponent(titelEncoded.replace(/\+/g, ' '))
        
        artistTitlePairs.push({
          artist,
          title,
          displayArtist: displayText,
          displayTitle: displayText
        })
      }

      // Group pairs - elke entry heeft 2 links (artiest en titel)
      for (let i = 0; i < artistTitlePairs.length - 1; i += 2) {
        const artistLink = artistTitlePairs[i]
        const titleLink = artistTitlePairs[i + 1]
        
        if (artistLink && titleLink && entries.length < limit) {
          entries.push({
            position: entries.length + 1,
            artist: decodeHtmlEntities(artistLink.displayArtist),
            title: decodeHtmlEntities(titleLink.displayTitle)
          })
        }
      }
    }

    // Methode 3: Parse als markdown tabel (voor web_fetch converted content)
    if (entries.length === 0) {
      // Markdown tabel format:
      // | **1** | 52 | 2 |  | [Kris Kross...](showitem.asp?...) | [Vluchtstrook](showitem.asp?...) | LABEL | 100 |
      const mdRowPattern = /\|\s*\*?\*?(\d+)\*?\*?\s*\|[^|]*\|[^|]*\|[^|]*\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*\[([^\]]+)\]\([^)]+\)/g
      
      while ((match = mdRowPattern.exec(html)) !== null && entries.length < limit) {
        const position = parseInt(match[1], 10)
        const artist = decodeHtmlEntities(match[2].trim())
        const title = decodeHtmlEntities(match[3].trim())
        
        if (position > 0 && title && artist) {
          entries.push({
            position,
            title,
            artist
          })
        }
      }
    }

    result.entries = entries
    result.totalEntries = entries.length

  } catch (error) {
    console.error('[DutchCharts] Parse error:', error)
  }

  return result
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}