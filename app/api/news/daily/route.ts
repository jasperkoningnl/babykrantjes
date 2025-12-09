// app/api/news/daily/route.ts
// @version 2.0.0
// Wikipedia Current Events scraper voor internationaal nieuws op een specifieke dag
// Ondersteunt alle structuren van 2002 tot heden:
// - Jan-Feb 2002: maand-pagina met anker
// - Mrt 2002+: dag-specifieke pagina's
// - Categorieën: <div class="current-events-content-heading">, <p><b>, of geen

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '2.0.0'

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
  debug?: {
    categoriesFound: string[]
    urlType: 'day-page' | 'month-page'
    parseMethod: string
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

  // Check minimum datum (eerste Current Events pagina is januari 2002)
  if (year < 2002 || (year === 2002 && month < 1)) {
    return NextResponse.json({
      date: dateParam,
      events: [],
      totalEvents: 0,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'No news data available before January 2002'
    })
  }

  const monthName = MONTHS_EN[month - 1]
  
  // Bepaal URL strategie:
  // - Jan-Feb 2002: gebruik maand-pagina met anker
  // - Vanaf 1 maart 2002: gebruik dag-specifieke pagina
  const useMonthPage = year === 2002 && month <= 2
  
  let webUrl: string
  let urlType: 'day-page' | 'month-page'
  
  if (useMonthPage) {
    // Maand-pagina URL met anker
    webUrl = `https://en.wikipedia.org/wiki/Portal:Current_events/${monthName}_${year}`
    urlType = 'month-page'
  } else {
    // Dag-specifieke URL
    webUrl = `https://en.wikipedia.org/wiki/Portal:Current_events/${year}_${monthName}_${day}`
    urlType = 'day-page'
  }

  const emptyResult: DailyNewsResult = {
    date: dateParam,
    events: [],
    totalEvents: 0,
    source: 'Wikipedia Portal:Current_events',
    sourceUrl: webUrl,
    apiVersion: API_VERSION
  }

  try {
    console.log(`[NewsDaily v${API_VERSION}] Fetching: ${webUrl} (${urlType})`)

    const response = await fetch(webUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/2.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 86400 * 30 }
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
    
    // Parse content afhankelijk van URL type
    let parseResult: { events: NewsEvent[], categoriesFound: string[], parseMethod: string }
    
    if (useMonthPage) {
      // Extract content voor specifieke dag uit maand-pagina
      parseResult = parseMonthPageForDay(html, year, month, day, monthName)
    } else {
      // Parse dag-specifieke pagina
      parseResult = parseDayPage(html)
    }

    const { events, categoriesFound, parseMethod } = parseResult

    console.log(`[NewsDaily v${API_VERSION}] Found ${events.length} events in ${categoriesFound.length} categories for ${dateParam} (method: ${parseMethod})`)

    return NextResponse.json({
      date: dateParam,
      events,
      totalEvents: events.length,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: useMonthPage ? `${webUrl}#${year}_${monthName}_${day}` : webUrl,
      apiVersion: API_VERSION,
      debug: {
        categoriesFound,
        urlType,
        parseMethod
      }
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
 * Parse een dag-specifieke pagina (maart 2002 en later)
 */
function parseDayPage(html: string): { events: NewsEvent[], categoriesFound: string[], parseMethod: string } {
  const events: NewsEvent[] = []
  const categoriesFound: string[] = []
  let parseMethod = 'none'

  // Zoek de content div
  const contentHtml = extractContentDiv(html)
  if (!contentHtml) {
    console.log('[NewsDaily] Could not find content div')
    return { events, categoriesFound, parseMethod: 'no-content-div' }
  }

  // Probeer verschillende parse methodes in volgorde van waarschijnlijkheid
  
  // Methode 1: <div class="current-events-content-heading"> (2010-2015)
  if (events.length === 0) {
    parseWithContentHeadingDivs(contentHtml, events, categoriesFound)
    if (events.length > 0) parseMethod = 'content-heading-divs'
  }

  // Methode 2: <p><b>Category</b></p> of <p><b>Category</b>\n (2010+, 2020+)
  if (events.length === 0) {
    parseWithParagraphBold(contentHtml, events, categoriesFound)
    if (events.length > 0) parseMethod = 'paragraph-bold'
  }

  // Methode 3: Directe <ul><li> zonder categorieën (2002-2009)
  if (events.length === 0) {
    parseWithoutCategories(contentHtml, events, categoriesFound)
    if (events.length > 0) parseMethod = 'no-categories'
  }

  return { events, categoriesFound, parseMethod }
}

/**
 * Parse een maand-pagina en extract content voor specifieke dag (jan-feb 2002)
 */
function parseMonthPageForDay(
  html: string, 
  year: number, 
  month: number, 
  day: number,
  monthName: string
): { events: NewsEvent[], categoriesFound: string[], parseMethod: string } {
  const events: NewsEvent[] = []
  const categoriesFound: string[] = []
  
  // Zoek het anker voor deze dag: id="2002_January_1" of id="2002&#95;January&#95;1"
  const anchorPatterns = [
    `id="${year}_${monthName}_${day}"`,
    `id="${year}&#95;${monthName}&#95;${day}"`,
    `id="${year}_${monthName}_${String(day).padStart(2, '0')}"`,
    `id="${year}&#95;${monthName}&#95;${String(day).padStart(2, '0')}"`
  ]
  
  let startIndex = -1
  for (const pattern of anchorPatterns) {
    const idx = html.indexOf(pattern)
    if (idx !== -1) {
      startIndex = idx
      break
    }
  }
  
  if (startIndex === -1) {
    console.log(`[NewsDaily] Could not find anchor for ${year}_${monthName}_${day}`)
    return { events, categoriesFound, parseMethod: 'anchor-not-found' }
  }

  // Zoek de content div na het anker
  const afterAnchor = html.substring(startIndex)
  const contentStart = afterAnchor.indexOf('<div class="current-events-content description">')
  
  if (contentStart === -1) {
    console.log('[NewsDaily] Could not find content div after anchor')
    return { events, categoriesFound, parseMethod: 'no-content-after-anchor' }
  }

  // Zoek het einde van deze dag (volgende current-events-main of einde van sectie)
  const contentAfterStart = afterAnchor.substring(contentStart)
  const endMarkers = [
    '<div class="current-events-main',
    '<div class="current-events-nav',
    '<div class="current-events-calendar'
  ]
  
  let endIndex = contentAfterStart.length
  for (const marker of endMarkers) {
    const idx = contentAfterStart.indexOf(marker, 50) // Skip eerste deel
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx
    }
  }

  const dayContent = contentAfterStart.substring(0, endIndex)
  
  // Parse de content (vroege pagina's hebben geen categorieën)
  parseWithoutCategories(dayContent, events, categoriesFound)
  
  return { 
    events, 
    categoriesFound, 
    parseMethod: events.length > 0 ? 'month-page-extracted' : 'month-page-empty' 
  }
}

/**
 * Extract de content div uit de pagina
 */
function extractContentDiv(html: string): string | null {
  // Probeer verschillende content div patronen
  const patterns = [
    // Specifieke current-events-content description div
    /<div class="current-events-content description">([\s\S]*?)<\/div>\s*<\/div>\s*(?:<\/div>)?\s*(?:<div class="current-events-nav|<link|$)/i,
    // Ruimere match
    /<div class="current-events-content description">([\s\S]*?)<\/div>\s*<\/div>/i,
    // Fallback: zoek in mw-parser-output
    /<div class="mw-content-ltr mw-parser-output"[^>]*>([\s\S]*?)<div class="printfooter"/i
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1] && match[1].length > 50) {
      return match[1]
    }
  }

  // Laatste poging: zoek content div en neem alles tot nav
  const startIdx = html.indexOf('<div class="current-events-content description">')
  if (startIdx !== -1) {
    const afterStart = html.substring(startIdx + 48)
    const endIdx = afterStart.search(/<div class="current-events-nav|<\/div>\s*<\/div>\s*<div class="current-events-nav/)
    if (endIdx !== -1) {
      return afterStart.substring(0, endIdx)
    }
    // Neem eerste 10000 karakters als fallback
    return afterStart.substring(0, 10000)
  }

  return null
}

/**
 * Parse met <div class="current-events-content-heading"> structuur (2010-2015 stijl)
 */
function parseWithContentHeadingDivs(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  const headingPattern = /<div\s+class="current-events-content-heading"[^>]*>([^<]+)<\/div>\s*<ul>([\s\S]*?)<\/ul>/gi
  
  let match
  while ((match = headingPattern.exec(contentHtml)) !== null) {
    const categoryName = cleanText(match[1])
    const ulContent = match[2]
    
    if (!categoryName || categoryName.length < 2 || categoryName.length > 80) continue
    
    if (!categoriesFound.includes(categoryName)) {
      categoriesFound.push(categoryName)
    }
    
    const items = parseListItems(ulContent)
    
    for (const itemText of items) {
      if (itemText.length > 15) {
        events.push({
          category: categoryName,
          text: itemText
        })
      }
    }
  }
}

/**
 * Parse met <p><b>Category</b></p> of <p><b>Category</b>\n structuur (2010+, 2020+ stijl)
 */
function parseWithParagraphBold(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  // Pattern voor <p><b>Category</b></p> gevolgd door <ul> OF
  // <p><b>Category</b>\n gevolgd door <ul>
  const pattern = /<p>\s*<b>([^<]+)<\/b>\s*(?:<\/p>)?\s*<ul>([\s\S]*?)<\/ul>/gi
  
  let match
  while ((match = pattern.exec(contentHtml)) !== null) {
    const categoryName = cleanText(match[1])
    const ulContent = match[2]
    
    if (!categoryName || categoryName.length < 2 || categoryName.length > 80) continue
    
    // Filter niet-categorie headers
    const lowerCat = categoryName.toLowerCase()
    if (lowerCat.includes('see also') || lowerCat.includes('references') || 
        lowerCat.includes('external links') || lowerCat.includes('further reading')) {
      continue
    }
    
    if (!categoriesFound.includes(categoryName)) {
      categoriesFound.push(categoryName)
    }
    
    const items = parseListItems(ulContent)
    
    for (const itemText of items) {
      if (itemText.length > 15) {
        events.push({
          category: categoryName,
          text: itemText
        })
      }
    }
  }
}

/**
 * Parse zonder categorieën - alle items onder "General News" (2002-2009 stijl)
 */
function parseWithoutCategories(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  const defaultCategory = 'General News'
  
  // Zoek alle <ul>...</ul> blokken
  const ulPattern = /<ul>([\s\S]*?)<\/ul>/gi
  
  let match
  let foundItems = false
  
  while ((match = ulPattern.exec(contentHtml)) !== null) {
    const ulContent = match[1]
    const items = parseListItems(ulContent)
    
    for (const itemText of items) {
      if (itemText.length > 15) {
        foundItems = true
        events.push({
          category: defaultCategory,
          text: itemText
        })
      }
    }
  }
  
  if (foundItems && !categoriesFound.includes(defaultCategory)) {
    categoriesFound.push(defaultCategory)
  }
}

/**
 * Parse list items uit een <ul> content block
 */
function parseListItems(ulContent: string): string[] {
  const items: string[] = []
  const seen = new Set<string>()
  
  // Split op </li> en parse elke sectie
  const liParts = ulContent.split(/<\/li>/i)
  
  for (const part of liParts) {
    // Zoek het begin van deze <li>
    const liStart = part.lastIndexOf('<li')
    if (liStart === -1) continue
    
    // Neem alles vanaf <li>
    let liContent = part.substring(liStart)
    
    // Verwijder de <li> tag zelf
    liContent = liContent.replace(/<li[^>]*>/i, '')
    
    // Verwijder geneste <ul>...</ul> blokken (sub-items)
    // maar behoud de tekst van het hoofditem
    const nestedUlStart = liContent.indexOf('<ul')
    if (nestedUlStart !== -1) {
      liContent = liContent.substring(0, nestedUlStart)
    }
    
    // Clean de tekst
    const cleanedText = cleanText(liContent)
    
    // Filter duplicaten, te korte items, en navigatie-tekst
    const lowerText = cleanedText.toLowerCase()
    if (cleanedText.length > 15 && 
        !seen.has(lowerText) &&
        !lowerText.startsWith('edit') &&
        !lowerText.startsWith('history') &&
        !lowerText.startsWith('watch')) {
      seen.add(lowerText)
      items.push(cleanedText)
    }
  }
  
  return items
}

/**
 * Clean HTML en tekst
 */
function cleanText(html: string): string {
  let text = html
  
  // Verwijder HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  
  // Verwijder scripts en styles
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  
  // Verwijder geneste <ul>...</ul> en <li> tags maar behoud tekst
  text = text.replace(/<\/?ul[^>]*>/gi, ' ')
  text = text.replace(/<\/?li[^>]*>/gi, ' ')
  
  // Converteer <a> tags naar hun tekst
  text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
  
  // Verwijder <sup> referentie tags
  text = text.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
  
  // Verwijder overige HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Verwijder Wikipedia referentie nummers [1], [2], etc.
  text = text.replace(/\[\d+\]/g, '')
  text = text.replace(/\[citation needed\]/gi, '')
  text = text.replace(/\[permanent dead link\]/gi, '')
  
  // Verwijder source citations (bv. "(BBC News)", "(Reuters)")
  text = text.replace(/\s*\([^)]*(?:News|Times|Post|Guardian|Reuters|AFP|AP|BBC|CNN|Forbes|Journal|Economist|Yahoo|Sky|RTÉ|Setanta|Al Jazeera|NPR|UPI|Xinhua|VOA|CBC|NYT|Globe)[^)]*\)\s*/gi, ' ')
  
  // Verwijder URLs
  text = text.replace(/https?:\/\/[^\s<>"]+/gi, '')
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#0?39;/g, "'")
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&#91;/g, '[')
  text = text.replace(/&#93;/g, ']')
  text = text.replace(/&#160;/g, ' ')
  text = text.replace(/&#95;/g, '_')
  
  // Verwijder → en andere speciale karakters aan het begin
  text = text.replace(/^[\s→•·\-–—]+/, '')
  
  // Verwijder dubbele spaties en trim
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}