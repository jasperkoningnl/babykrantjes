// app/api/news/dutch/route.ts
// @version 1.0.0
// Volkskrant archief scraper voor Nederlandse nieuwsheadlines op een specifieke dag
// Archief beschikbaar vanaf 18 augustus 2017

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

// Vroegste beschikbare datum in het Volkskrant archief
const EARLIEST_DATE = new Date('2017-08-18')

interface DutchNewsHeadline {
  title: string
  url: string
  category: string | null
}

interface DutchNewsResult {
  date: string
  headlines: DutchNewsHeadline[]
  totalHeadlines: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
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

  // Check of datum binnen bereik valt
  const requestedDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (requestedDate < EARLIEST_DATE) {
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      source: 'de Volkskrant',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: `Volkskrant archief is alleen beschikbaar vanaf 18 augustus 2017. Gevraagde datum (${dateParam}) valt buiten dit bereik.`
    })
  }

  if (requestedDate > today) {
    return NextResponse.json({
      date: dateParam,
      headlines: [],
      totalHeadlines: 0,
      source: 'de Volkskrant',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: `Gevraagde datum (${dateParam}) ligt in de toekomst.`
    })
  }

  // Bouw URL: https://www.volkskrant.nl/archief/YYYY/MM/DD
  const monthPadded = String(month).padStart(2, '0')
  const dayPadded = String(day).padStart(2, '0')
  const archiveUrl = `https://www.volkskrant.nl/archief/${year}/${monthPadded}/${dayPadded}`

  const emptyResult: DutchNewsResult = {
    date: dateParam,
    headlines: [],
    totalHeadlines: 0,
    source: 'de Volkskrant',
    sourceUrl: archiveUrl,
    apiVersion: API_VERSION
  }

  try {
    console.log(`[DutchNews v${API_VERSION}] Fetching: ${archiveUrl}`)

    const response = await fetch(archiveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 86400 * 30 } // Cache voor 30 dagen (historische data)
    })

    if (response.status === 404) {
      console.log(`[DutchNews] Archive page not found for ${dateParam}`)
      return NextResponse.json({
        ...emptyResult,
        error: `Geen archiefpagina gevonden voor ${dateParam}`
      })
    }

    if (!response.ok) {
      console.error(`[DutchNews] HTTP ${response.status}`)
      return NextResponse.json({
        ...emptyResult,
        error: `Volkskrant returned HTTP ${response.status}`
      })
    }

    const html = await response.text()
    const headlines = parseVolkskrantArchive(html)

    console.log(`[DutchNews v${API_VERSION}] Found ${headlines.length} headlines for ${dateParam}`)

    return NextResponse.json({
      date: dateParam,
      headlines,
      totalHeadlines: headlines.length,
      source: 'de Volkskrant',
      sourceUrl: archiveUrl,
      apiVersion: API_VERSION
    })

  } catch (error) {
    console.error('[DutchNews] Error:', error)
    return NextResponse.json({
      ...emptyResult,
      error: 'Failed to fetch Dutch news data'
    })
  }
}

/**
 * Parse de Volkskrant archiefpagina voor headlines
 */
function parseVolkskrantArchive(html: string): DutchNewsHeadline[] {
  const headlines: DutchNewsHeadline[] = []
  const seen = new Set<string>()

  // Methode 1: Zoek <article class="teaser--compact"> blokken
  // Elke article bevat:
  // - <a href="URL" class="teaser__link">
  // - <h3 class="teaser__title--compact" data-teaser-title>TITLE</h3>
  // - Optioneel: <span class="teaser__label">CATEGORY</span>

  const articlePattern = /<article\s+class="teaser--compact"[\s\S]*?<\/article>/gi
  const articles = html.match(articlePattern) || []

  for (const article of articles) {
    // Extract URL
    const urlMatch = article.match(/<a\s+href="([^"]+)"\s+class="teaser__link"/)
    const url = urlMatch ? urlMatch[1] : null

    // Extract title
    const titleMatch = article.match(/<h3\s+class="teaser__title--compact"[^>]*>([^<]+)<\/h3>/)
    const title = titleMatch ? cleanText(titleMatch[1]) : null

    // Extract category from URL path or label
    let category: string | null = null
    
    // Probeer categorie uit URL te halen (bijv. /nieuws-achtergrond/, /sport/, /columns-opinie/)
    if (url) {
      const categoryMatch = url.match(/volkskrant\.nl\/([^/]+)\//)
      if (categoryMatch) {
        category = formatCategory(categoryMatch[1])
      }
    }
    
    // Of uit de label span
    const labelMatch = article.match(/<span\s+class="teaser__label[^"]*"[^>]*>([^<]+)<\/span>/)
    if (labelMatch) {
      const labelCategory = cleanText(labelMatch[1])
      if (labelCategory && labelCategory.length > 0) {
        category = labelCategory
      }
    }

    // Valideer en voeg toe
    if (title && title.length > 5 && url) {
      const titleLower = title.toLowerCase()
      
      // Skip duplicaten
      if (seen.has(titleLower)) continue
      seen.add(titleLower)

      // Zorg voor absolute URL
      const absoluteUrl = url.startsWith('http') ? url : `https://www.volkskrant.nl${url}`

      headlines.push({
        title,
        url: absoluteUrl,
        category
      })
    }
  }

  // Methode 2: Fallback - zoek direct naar teaser titles als geen articles gevonden
  if (headlines.length === 0) {
    const titlePattern = /<h3\s+class="teaser__title[^"]*"[^>]*>([^<]+)<\/h3>/gi
    let match
    
    while ((match = titlePattern.exec(html)) !== null) {
      const title = cleanText(match[1])
      if (title && title.length > 5) {
        const titleLower = title.toLowerCase()
        if (!seen.has(titleLower)) {
          seen.add(titleLower)
          headlines.push({
            title,
            url: '',
            category: null
          })
        }
      }
    }
  }

  return headlines
}

/**
 * Format category slug naar leesbare naam
 */
function formatCategory(slug: string): string {
  const categoryMap: Record<string, string> = {
    'nieuws-achtergrond': 'Nieuws & Achtergrond',
    'columns-opinie': 'Columns & Opinie',
    'cultuur-media': 'Cultuur & Media',
    'wetenschap': 'Wetenschap',
    'sport': 'Sport',
    'economie': 'Economie',
    'politiek': 'Politiek',
    'buitenland': 'Buitenland',
    'binnenland': 'Binnenland',
    'tech': 'Tech',
    'mensen': 'Mensen',
    'kijkverder': 'Kijk Verder',
    'recensies': 'Recensies',
    'podcasts': 'Podcasts',
    'video': 'Video'
  }

  return categoryMap[slug] || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
}

/**
 * Clean text van HTML entities en whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}