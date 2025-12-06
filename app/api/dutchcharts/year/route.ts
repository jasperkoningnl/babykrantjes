// app/api/dutchcharts/year/route.ts
// @version 1.0.0
// Server-side scraper voor DutchCharts.nl jaaroverzichten
// Bron: https://dutchcharts.nl/jaaroverzichten.asp

import { NextRequest, NextResponse } from 'next/server'

interface YearChartEntry {
  position: number
  title: string
  artist: string
  peakPosition?: number
  weeksInChart?: number
}

interface DutchChartsYearResult {
  entries: YearChartEntry[]
  year: number
  totalEntries: number
  source: string
  sourceUrl: string
}

/**
 * GET /api/dutchcharts/year?year=YYYY&limit=N
 * Haalt het jaaroverzicht singles op
 */
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
  
  // Valideer jaar (DutchCharts gaat terug tot 1956)
  if (year < 1956 || year > new Date().getFullYear()) {
    return NextResponse.json(
      { error: 'Year must be between 1956 and current year' },
      { status: 400 }
    )
  }

  try {
    // DutchCharts URL patroon voor jaaroverzichten
    const url = `https://dutchcharts.nl/jaaroverzichten.asp?year=${year}&cat=s`
    console.log(`[DutchCharts] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 } // Cache 24 uur
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

    return NextResponse.json(result)

  } catch (error) {
    console.error('[DutchCharts] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DutchCharts data' },
      { status: 500 }
    )
  }
}

/**
 * Parse DutchCharts jaaroverzicht HTML
 */
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

    // DutchCharts gebruikt een tabel structuur
    // Zoek naar table rows met chart data
    
    // Patroon 1: Tabel rows met positie, titel, artiest
    // <tr><td>1</td><td><a href="...">Titel</a></td><td>Artiest</td>...</tr>
    const tableRowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/td>[\s\S]*?<td[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/td>/gi

    let match
    while ((match = tableRowPattern.exec(html)) !== null && entries.length < limit) {
      const position = parseInt(match[1], 10)
      const title = decodeHtmlEntities(match[2].trim())
      const artist = decodeHtmlEntities(match[3].trim())
      
      // Filter lege entries
      if (title && artist && position > 0) {
        entries.push({
          position,
          title,
          artist
        })
      }
    }

    // Alternatief patroon als de tabel anders is opgebouwd
    if (entries.length === 0) {
      // Zoek naar links met /song/ of /nummer/ in href
      const altPattern = /<a[^>]*href="[^"]*(?:\/song\/|\/nummer\/)[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*href="[^"]*(?:\/artist\/|\/artiest\/)[^"]*"[^>]*>([^<]+)<\/a>/gi
      
      let pos = 1
      while ((match = altPattern.exec(html)) !== null && entries.length < limit) {
        entries.push({
          position: pos++,
          title: decodeHtmlEntities(match[1].trim()),
          artist: decodeHtmlEntities(match[2].trim())
        })
      }
    }

    // Nog een fallback: zoek naar specifieke class names
    if (entries.length === 0) {
      const classPattern = /class="[^"]*chart[^"]*"[\s\S]*?(\d+)[\s\S]*?<[^>]*>([^<]+)<[\s\S]*?<[^>]*>([^<]+)</gi
      
      while ((match = classPattern.exec(html)) !== null && entries.length < limit) {
        entries.push({
          position: parseInt(match[1], 10),
          title: decodeHtmlEntities(match[2].trim()),
          artist: decodeHtmlEntities(match[3].trim())
        })
      }
    }

    result.entries = entries
    result.totalEntries = entries.length

  } catch (error) {
    console.error('[DutchCharts] Parse error:', error)
  }

  return result
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
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}