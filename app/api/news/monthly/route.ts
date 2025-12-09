// app/api/news/monthly/route.ts
// @version 1.2.0
// Wikipedia NL maandoverzicht scraper voor Nederlands nieuws
// Bron: https://nl.wikipedia.org/wiki/{Maand}_{jaar}
// FIX v1.2.0: Correcte parsing van <h3> datum headers + <ul><li> items

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.2.0'

const MONTHS_NL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
]

// Maandnamen met hoofdletter voor de URL
const MONTHS_NL_CAPITALIZED = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
]

interface NewsItem {
  day: number
  text: string
}

interface MonthNewsResult {
  year: number
  month: number
  monthName: string
  items: NewsItem[]
  totalItems: number
  source: string
  sourceUrl: string
  apiVersion: string
  debug?: {
    datesFound: string[]
    rawItemCount: number
  }
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

  const [yearStr, monthStr] = dateParts
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid date values' },
      { status: 400 }
    )
  }

  const monthName = MONTHS_NL_CAPITALIZED[month - 1]
  const pageTitle = `${monthName}_${year}`
  const webUrl = `https://nl.wikipedia.org/wiki/${pageTitle}`

  const emptyResult: MonthNewsResult = {
    year,
    month,
    monthName: MONTHS_NL[month - 1],
    items: [],
    totalItems: 0,
    source: 'Wikipedia NL Maandoverzicht',
    sourceUrl: webUrl,
    apiVersion: API_VERSION
  }

  try {
    console.log(`[NewsMonthly v${API_VERSION}] Fetching: ${webUrl}`)

    const response = await fetch(webUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 * 30 }
    })

    if (response.status === 404) {
      console.log(`[NewsMonthly] Page not found for ${monthName} ${year}`)
      return NextResponse.json({
        ...emptyResult,
        error: `No news page found for ${monthName} ${year}`
      })
    }

    if (!response.ok) {
      console.error(`[NewsMonthly] HTTP ${response.status}`)
      return NextResponse.json({
        ...emptyResult,
        error: `Wikipedia returned ${response.status}`
      })
    }

    const html = await response.text()
    const { items, datesFound } = parseMonthOverviewHtml(html, month)

    console.log(`[NewsMonthly v${API_VERSION}] Found ${items.length} items for ${datesFound.length} dates in ${monthName} ${year}`)

    return NextResponse.json({
      year,
      month,
      monthName: MONTHS_NL[month - 1],
      items,
      totalItems: items.length,
      source: 'Wikipedia NL Maandoverzicht',
      sourceUrl: webUrl,
      apiVersion: API_VERSION,
      debug: {
        datesFound,
        rawItemCount: items.length
      }
    })

  } catch (error) {
    console.error('[NewsMonthly] Error:', error)
    return NextResponse.json({
      ...emptyResult,
      error: 'Failed to fetch news data'
    })
  }
}

function parseMonthOverviewHtml(html: string, month: number): { items: NewsItem[], datesFound: string[] } {
  const items: NewsItem[] = []
  const datesFound: string[] = []

  try {
    // Zoek de content sectie
    const contentMatch = html.match(/<div id="mw-content-text"[^>]*>([\s\S]*?)<div class="printfooter"/i)
    
    if (!contentMatch) {
      console.log('[NewsMonthly] Could not find mw-content-text div')
      return { items, datesFound }
    }

    let contentHtml = contentMatch[1]

    // Stop bij "Overleden" sectie
    const overledenIndex = contentHtml.indexOf('id="Overleden"')
    if (overledenIndex !== -1) {
      contentHtml = contentHtml.substring(0, overledenIndex)
    }

    // Ook stoppen bij bronnen/referenties sectie
    const bronnenIndex = contentHtml.indexOf('class="references"')
    if (bronnenIndex !== -1) {
      contentHtml = contentHtml.substring(0, bronnenIndex)
    }

    // Nederlandse Wikipedia structuur:
    // <div class="mw-heading mw-heading3"><h3 id="3_maart">...</h3>...</div>
    // <ul><li>Nieuws item 1</li><li>Nieuws item 2</li></ul>
    // <div class="mw-heading mw-heading3"><h3 id="4_maart">...</h3>...</div>
    // <ul>...</ul>

    // Parse datum headers en hun items
    // We zoeken naar <h3 id="X_maand"> gevolgd door <ul><li> items
    
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                        'juli', 'augustus', 'september', 'oktober', 'november', 'december']
    const monthName = monthNames[month - 1]
    
    // Regex om datum headers te vinden: <h3 id="3_maart"> of <h3 id="15_maart">
    const dateHeaderPattern = new RegExp(
      `<h3[^>]*id="(\\d{1,2})_${monthName}"[^>]*>`,
      'gi'
    )

    // Vind alle datum posities
    const datePositions: { day: number, startIndex: number }[] = []
    let headerMatch
    
    while ((headerMatch = dateHeaderPattern.exec(contentHtml)) !== null) {
      const day = parseInt(headerMatch[1], 10)
      datePositions.push({
        day,
        startIndex: headerMatch.index
      })
      datesFound.push(`${day} ${monthName}`)
    }

    // Voor elke datum, vind de <ul> die erna komt
    for (let i = 0; i < datePositions.length; i++) {
      const currentPos = datePositions[i]
      const nextPos = datePositions[i + 1]
      
      // Bepaal het bereik voor deze datum
      const startIndex = currentPos.startIndex
      const endIndex = nextPos ? nextPos.startIndex : contentHtml.length
      
      const sectionHtml = contentHtml.substring(startIndex, endIndex)
      
      // Zoek de <ul> in deze sectie
      const ulMatch = sectionHtml.match(/<ul>([\s\S]*?)<\/ul>/i)
      if (!ulMatch) continue
      
      const ulContent = ulMatch[1]
      
      // Parse <li> items
      const liItems = parseListItems(ulContent)
      
      for (const itemText of liItems) {
        if (itemText.length > 15) {
          items.push({
            day: currentPos.day,
            text: itemText
          })
        }
      }
    }

    // Sorteer op dag
    items.sort((a, b) => a.day - b.day)

  } catch (error) {
    console.error('[NewsMonthly] Parse error:', error)
  }

  return { items, datesFound }
}

function parseListItems(ulContent: string): string[] {
  const items: string[] = []
  
  // Split op </li> tags
  const liParts = ulContent.split(/<\/li>/i)
  
  for (const part of liParts) {
    // Zoek <li> start
    const liStart = part.lastIndexOf('<li')
    if (liStart === -1) continue
    
    // Neem content na <li>
    let liContent = part.substring(liStart)
    liContent = liContent.replace(/<li[^>]*>/i, '')
    
    // Clean de tekst
    const cleanedText = cleanText(liContent)
    
    // Filter te korte items en navigatie
    if (cleanedText.length > 15 && !isNavigationText(cleanedText)) {
      items.push(cleanedText)
    }
  }
  
  return items
}

function isNavigationText(text: string): boolean {
  const lowerText = text.toLowerCase()
  
  // Filter navigatie en intro tekst
  const skipPatterns = [
    'chronologisch overzicht',
    'belangrijkste gebeurtenissen',
    'bewerken',
    'brontekst',
    'lees verder',
    '← ·',
    '· →',
    'wikinieuws'
  ]
  
  return skipPatterns.some(pattern => lowerText.includes(pattern))
}

function cleanText(html: string): string {
  let text = html
  
  // Verwijder HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  
  // Verwijder scripts en styles
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  
  // Verwijder edit section links
  text = text.replace(/<span class="mw-editsection">[\s\S]*?<\/span>/gi, '')
  
  // Verwijder referentie/citation links [1], [2] etc
  text = text.replace(/<sup[^>]*class="reference"[^>]*>[\s\S]*?<\/sup>/gi, '')
  
  // Verwijder Wikinieuws iconen en links
  text = text.replace(/<span[^>]*class="nowrap"[^>]*>[\s\S]*?Wikinieuws[\s\S]*?<\/span>/gi, '')
  
  // Converteer <a> tags naar hun tekst
  text = text.replace(/<a[^>]*title="([^"]*)"[^>]*>[^<]*<\/a>/gi, '$1')
  text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
  
  // Verwijder geneste lijsten
  text = text.replace(/<\/?ul[^>]*>/gi, ' ')
  text = text.replace(/<\/?li[^>]*>/gi, ' ')
  
  // Verwijder "(Lees verder)" links
  text = text.replace(/\(Lees verder\)/gi, '')
  
  // Verwijder overige HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&#91;/g, '[')
  text = text.replace(/&#93;/g, ']')
  text = text.replace(/&#160;/g, ' ')
  text = text.replace(/&#95;/g, '_')
  
  // Verwijder dubbele spaties en trim
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}