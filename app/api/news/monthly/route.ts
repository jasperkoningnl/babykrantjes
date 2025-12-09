// app/api/news/monthly/route.ts
// @version 1.1.0
// Wikipedia NL maandoverzicht scraper
// Bron: https://nl.wikipedia.org/wiki/{Maand}_{jaar}
// FIX: Betere filtering van intro tekst, zoek naar echte nieuwsitems

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.1.0'

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
  const dateParam = searchParams.get('date')

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD or YYYY-MM)' },
      { status: 400 }
    )
  }

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
    console.log(`[NewsMonthly] Fetching: ${webUrl}`)

    const response = await fetch(webUrl, {
      headers: {
        'User-Agent': 'BabykrantBot/1.0 (educational project)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 * 30 }
    })

    if (!response.ok) {
      console.error(`[NewsMonthly] HTTP ${response.status}`)
      return NextResponse.json({
        ...emptyResult,
        error: `Page not found for ${monthNameCapitalized} ${year}`
      })
    }

    const html = await response.text()
    const items = parseMonthPageHtml(html, year)

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

function parseMonthPageHtml(html: string, year: number): string[] {
  const items: string[] = []
  const seenTexts = new Set<string>()
  const MAX_ITEMS = 20

  try {
    // Zoek de content sectie
    const contentMatch = html.match(/<div[^>]*id="mw-content-text"[^>]*>([\s\S]*?)(?:<div[^>]*class="printfooter"|<div[^>]*id="catlinks")/i)
    const contentHtml = contentMatch ? contentMatch[1] : html

    // Patronen voor intro tekst die we moeten skippen
    const skipPatterns = [
      /dit artikel geeft een/i,
      /chronologisch overzicht/i,
      /belangrijkste gebeurtenissen/i,
      /zie ook/i,
      /externe link/i,
      /referenties/i,
      /navigatiemenu/i,
      /^[\s]*$/,
    ]

    // Zoek naar list items die beginnen met een dag nummer
    // Format: "1 - Gebeurtenis" of "1 januari - Gebeurtenis" of gewoon een nieuwsfeit
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    while ((match = listItemPattern.exec(contentHtml)) !== null && items.length < MAX_ITEMS) {
      const rawText = match[1]
      const text = cleanWikiText(rawText)

      // Skip te korte of te lange teksten
      if (text.length < 20 || text.length > 500) continue

      // Skip intro/navigatie teksten
      const shouldSkip = skipPatterns.some(pattern => pattern.test(text))
      if (shouldSkip) continue

      // Skip duplicaten
      const textLower = text.toLowerCase()
      if (seenTexts.has(textLower)) continue

      // Skip als het alleen een maandnaam of jaar is
      if (/^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|\d{4})$/i.test(text.trim())) {
        continue
      }

      // Skip navigatie links
      if (/^[←→]/.test(text) || /^\d{4}$/.test(text.trim())) continue

      seenTexts.add(textLower)
      items.push(text)
    }

    // Als geen list items gevonden, zoek in paragraphs
    if (items.length === 0) {
      const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi
      while ((match = pPattern.exec(contentHtml)) !== null && items.length < MAX_ITEMS) {
        const text = cleanWikiText(match[1])
        
        if (text.length < 30 || text.length > 500) continue
        
        const shouldSkip = skipPatterns.some(pattern => pattern.test(text))
        if (shouldSkip) continue

        const textLower = text.toLowerCase()
        if (seenTexts.has(textLower)) continue

        seenTexts.add(textLower)
        items.push(text)
      }
    }

    // Sorteer items die met een dagnummer beginnen naar voren
    items.sort((a, b) => {
      const aStartsWithDay = /^\d{1,2}[\s\-–]/.test(a)
      const bStartsWithDay = /^\d{1,2}[\s\-–]/.test(b)
      if (aStartsWithDay && !bStartsWithDay) return -1
      if (!aStartsWithDay && bStartsWithDay) return 1
      return 0
    })

  } catch (error) {
    console.error('[NewsMonthly] Parse error:', error)
  }

  return items
}

function cleanWikiText(html: string): string {
  let text = html
    // Verwijder HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Verwijder sup tags (referenties)
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
    // Verwijder small tags
    .replace(/<small[^>]*>[\s\S]*?<\/small>/gi, '')
    // Converteer links naar tekst
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    // Verwijder overige HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Verwijder Wikipedia markup
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // Verwijder referenties
    .replace(/\[\d+\]/g, '')
    // Verwijder URLs
    .replace(/https?:\/\/[^\s)]+/g, '')
    // Normaliseer whitespace
    .replace(/\s+/g, ' ')
    .trim()

  // Decode HTML entities
  text = decodeHtmlEntities(text)

  return text
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
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