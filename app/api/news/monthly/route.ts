// app/api/news/monthly/route.ts
// @version 1.0.0
// Wikipedia NL maandoverzicht scraper
// Bron: https://nl.wikipedia.org/wiki/{Maand}_{jaar}

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

const MAANDEN_NL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
]

interface MonthNewsResult {
  year: number
  month: number
  monthName: string
  items: string[]
  totalItems: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD of YYYY-MM format

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD or YYYY-MM)' },
      { status: 400 }
    )
  }

  // Parse datum (ondersteunt YYYY-MM-DD en YYYY-MM)
  const dateParts = dateParam.split('-')
  if (dateParts.length < 2) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD or YYYY-MM' },
      { status: 400 }
    )
  }

  const year = parseInt(dateParts[0], 10)
  const month = parseInt(dateParts[1], 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid year or month values' },
      { status: 400 }
    )
  }

  // Nederlandse maandnaam met hoofdletter
  const monthName = MAANDEN_NL[month - 1]
  const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  const pageTitle = `${monthNameCapitalized}_${year}`
  const webUrl = `https://nl.wikipedia.org/wiki/${pageTitle}`

  const emptyResult: MonthNewsResult = {
    year,
    month,
    monthName: monthNameCapitalized,
    items: [],
    totalItems: 0,
    source: 'Wikipedia NL Maandoverzicht',
    sourceUrl: webUrl,
    apiVersion: API_VERSION
  }

  try {
    // Probeer eerst de normale web URL (werkt beter voor NL pagina's)
    console.log(`[NewsMonthly] Fetching: ${webUrl}`)

    let html = ''
    let fetchSuccess = false

    // Methode 1: Directe web URL
    const webResponse = await fetch(webUrl, {
      headers: {
        'User-Agent': 'BabykrantBot/1.0 (educational project)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 * 30 } // Cache 30 dagen
    })

    if (webResponse.ok) {
      html = await webResponse.text()
      fetchSuccess = true
      console.log(`[NewsMonthly] Web URL success`)
    } else {
      console.log(`[NewsMonthly] Web URL failed: ${webResponse.status}, trying REST API`)
      
      // Methode 2: Fallback naar REST API
      const apiUrl = `https://nl.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'BabykrantBot/1.0 (educational project)',
          'Accept': 'text/html'
        },
        next: { revalidate: 86400 * 30 }
      })

      if (apiResponse.ok) {
        html = await apiResponse.text()
        fetchSuccess = true
        console.log(`[NewsMonthly] REST API success`)
      } else {
        console.error(`[NewsMonthly] Both methods failed. Web: ${webResponse.status}, API: ${apiResponse.status}`)
      }
    }

    if (!fetchSuccess || !html) {
      return NextResponse.json({
        ...emptyResult,
        error: `Page not found for ${monthNameCapitalized} ${year}`
      })
    }

    const items = parseMonthPageHtml(html)

    console.log(`[NewsMonthly] Found ${items.length} items for ${monthNameCapitalized} ${year}`)

    return NextResponse.json({
      year,
      month,
      monthName: monthNameCapitalized,
      items,
      totalItems: items.length,
      source: 'Wikipedia NL Maandoverzicht',
      sourceUrl: webUrl,
      apiVersion: API_VERSION
    })

  } catch (error) {
    console.error('[NewsMonthly] Error:', error)
    return NextResponse.json({
      ...emptyResult,
      error: 'Failed to fetch month data'
    })
  }
}

/**
 * Parset de Wikipedia NL maandpagina HTML
 * Zoekt naar nieuwsfeiten in list items
 */
function parseMonthPageHtml(html: string): string[] {
  const items: string[] = []
  const MAX_ITEMS = 20

  try {
    // Zoek de content sectie (mw-content-text of body)
    let contentHtml = html

    // Probeer specifieke content div te vinden
    const contentMatch = html.match(/<div[^>]*id="mw-content-text"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/body|$)/i)
    if (contentMatch) {
      contentHtml = contentMatch[1]
    }

    // Parse alle list items
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    while ((match = listItemPattern.exec(contentHtml)) !== null && items.length < MAX_ITEMS) {
      const text = cleanNewsText(match[1])

      // Filter: moet lang genoeg zijn en er als een nieuwsfeit uitzien
      // Typisch beginnen NL maandfeiten met een dag nummer of zijn gewoon zinnen
      if (text.length > 30 && text.length < 500) {
        // Skip navigatie-achtige items
        if (isNavigationItem(text)) {
          continue
        }

        // Check voor duplicaten
        const isDuplicate = items.some(existing => 
          existing === text || 
          text.includes(existing) || 
          existing.includes(text)
        )

        if (!isDuplicate) {
          items.push(text)
        }
      }
    }

    // Als geen items gevonden via li, probeer paragraphs
    if (items.length === 0) {
      const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi
      while ((match = pPattern.exec(contentHtml)) !== null && items.length < MAX_ITEMS) {
        const text = cleanNewsText(match[1])
        if (text.length > 50 && text.length < 500 && !isNavigationItem(text)) {
          items.push(text)
        }
      }
    }

  } catch (error) {
    console.error('[NewsMonthly] Parse error:', error)
  }

  return items
}

/**
 * Detecteert navigatie/menu items die geen nieuws zijn
 */
function isNavigationItem(text: string): boolean {
  const navPatterns = [
    /^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s*$/i,
    /^\d{4}$/,
    /^Hoofdpagina$/i,
    /^Categorie:/i,
    /^Portal:/i,
    /^Sjabloon:/i,
    /^Bestand:/i,
    /^Wikipedia:/i,
    /^Overleg:/i,
    /^Hulp:/i,
    /^\[\[/,
    /^← .* →$/,  // Navigatie pijlen
  ]

  return navPatterns.some(pattern => pattern.test(text.trim()))
}

/**
 * Reinigt nieuws tekst
 */
function cleanNewsText(html: string): string {
  let text = html
    // Verwijder HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Verwijder Wikipedia referenties
    .replace(/\[\d+\]/g, '')
    // Verwijder wiki links markup
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    // Normaliseer whitespace
    .replace(/\s+/g, ' ')
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
    .replace(/&eacute;/g, 'é')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}