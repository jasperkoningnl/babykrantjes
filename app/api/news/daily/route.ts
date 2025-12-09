// app/api/news/daily/route.ts
// @version 1.2.0
// Wikipedia Current Events scraper voor internationaal nieuws op een specifieke dag
// Bron: https://en.wikipedia.org/wiki/Portal:Current_events/{jaar}_{maand}_{dag}
// FIX v1.2.0: Correcte parsing van <p><b>Category</b></p> + <ul><li> structuur

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.2.0'

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
    rawCategoryCount: number
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

  const monthName = MONTHS_EN[month - 1]
  const pageTitle = `Portal:Current_events/${year}_${monthName}_${day}`
  const webUrl = `https://en.wikipedia.org/wiki/${pageTitle.replace(/ /g, '_')}`

  const emptyResult: DailyNewsResult = {
    date: dateParam,
    events: [],
    totalEvents: 0,
    source: 'Wikipedia Portal:Current_events',
    sourceUrl: webUrl,
    apiVersion: API_VERSION
  }

  try {
    console.log(`[NewsDaily v${API_VERSION}] Fetching: ${webUrl}`)

    const response = await fetch(webUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
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
    const { events, categoriesFound } = parseCurrentEventsHtml(html)

    console.log(`[NewsDaily v${API_VERSION}] Found ${events.length} events in ${categoriesFound.length} categories for ${dateParam}`)

    return NextResponse.json({
      date: dateParam,
      events,
      totalEvents: events.length,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: webUrl,
      apiVersion: API_VERSION,
      debug: {
        categoriesFound,
        rawCategoryCount: categoriesFound.length
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

function parseCurrentEventsHtml(html: string): { events: NewsEvent[], categoriesFound: string[] } {
  const events: NewsEvent[] = []
  const categoriesFound: string[] = []

  try {
    // Zoek de content div: <div class="current-events-content description">
    const contentMatch = html.match(/<div\s+class="current-events-content\s+description">([\s\S]*?)<\/div>\s*<\/div>\s*<div\s+class="current-events-nav"/i)
    
    if (!contentMatch) {
      console.log('[NewsDaily] Could not find current-events-content div')
      // Fallback: probeer mw-parser-output
      const fallbackMatch = html.match(/<div class="mw-content-ltr mw-parser-output"[^>]*>([\s\S]*?)<div class="printfooter"/i)
      if (!fallbackMatch) {
        return { events, categoriesFound }
      }
    }

    const contentHtml = contentMatch ? contentMatch[1] : ''

    // Wikipedia structuur:
    // <p><b>Armed conflicts and attacks</b></p>
    // <ul><li>Item 1<ul><li>Sub-item</li></ul></li><li>Item 2</li></ul>
    // <p><b>Business and economy</b></p>
    // <ul>...</ul>

    // Split op <p><b> om categorieën te vinden
    const categoryPattern = /<p><b>([^<]+)<\/b>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>(?=\s*(?:<p><b>|$))/gi
    
    let match
    while ((match = categoryPattern.exec(contentHtml)) !== null) {
      const categoryName = cleanText(match[1])
      const ulContent = match[2]
      
      if (!categoryName || categoryName.length < 2) continue
      
      categoriesFound.push(categoryName)
      
      // Parse alle <li> items (alleen top-level, niet geneste)
      const items = parseListItems(ulContent)
      
      for (const itemText of items) {
        if (itemText.length > 10) {
          events.push({
            category: categoryName,
            text: itemText
          })
        }
      }
    }

    // Als de regex niet werkt, probeer een andere aanpak
    if (events.length === 0) {
      console.log('[NewsDaily] Trying alternative parsing method')
      
      // Splits op <p><b>
      const sections = contentHtml.split(/<p><b>/i)
      
      for (let i = 1; i < sections.length; i++) {
        const section = sections[i]
        
        // Extract category name (tot </b>)
        const categoryEndIndex = section.indexOf('</b>')
        if (categoryEndIndex === -1) continue
        
        const categoryName = cleanText(section.substring(0, categoryEndIndex))
        if (!categoryName || categoryName.length < 2 || categoryName.length > 60) continue
        
        categoriesFound.push(categoryName)
        
        // Zoek de <ul> na de category header
        const ulMatch = section.match(/<\/p>\s*<ul>([\s\S]*?)<\/ul>/i)
        if (!ulMatch) continue
        
        const items = parseListItems(ulMatch[1])
        
        for (const itemText of items) {
          if (itemText.length > 10) {
            events.push({
              category: categoryName,
              text: itemText
            })
          }
        }
      }
    }

  } catch (error) {
    console.error('[NewsDaily] Parse error:', error)
  }

  return { events, categoriesFound }
}

function parseListItems(ulContent: string): string[] {
  const items: string[] = []
  
  // We moeten top-level <li> items vinden, maar de geneste <ul><li> combineren
  // Strategie: vind elke <li> en bepaal de volledige tekst inclusief context
  
  // Verwijder eerst alle geneste <ul>...</ul> tijdelijk om alleen top-level te krijgen
  // Maar we willen wel de context behouden
  
  // Simpelere aanpak: splits op </li> en parse elke sectie
  const liParts = ulContent.split(/<\/li>/i)
  
  for (const part of liParts) {
    // Zoek het begin van deze <li>
    const liStart = part.lastIndexOf('<li')
    if (liStart === -1) continue
    
    // Neem alles vanaf <li>
    let liContent = part.substring(liStart)
    
    // Verwijder de <li> tag zelf
    liContent = liContent.replace(/<li[^>]*>/i, '')
    
    // Clean de tekst
    const cleanedText = cleanText(liContent)
    
    if (cleanedText.length > 10) {
      items.push(cleanedText)
    }
  }
  
  return items
}

function cleanText(html: string): string {
  let text = html
  
  // Verwijder HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  
  // Verwijder scripts en styles
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  
  // Verwijder geneste <ul>...</ul> blokken (sub-items worden deel van parent)
  // Maar behoud de tekst erin
  text = text.replace(/<\/?ul[^>]*>/gi, ' ')
  text = text.replace(/<\/?li[^>]*>/gi, ' ')
  
  // Converteer <a> tags naar hun tekst
  text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
  
  // Verwijder externe link indicatoren
  text = text.replace(/<a[^>]*class="[^"]*external[^"]*"[^>]*>[^<]*<\/a>/gi, '')
  
  // Verwijder overige HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Verwijder Wikipedia referentie nummers [1], [2], etc.
  text = text.replace(/\[\d+\]/g, '')
  
  // Verwijder source citations aan het eind (bv. "(BBC News)")
  text = text.replace(/\s*\([^)]*(?:News|Times|Post|Guardian|Reuters|AFP|AP|BBC|CNN|Forbes|Journal|Economist)[^)]*\)\s*/gi, ' ')
  
  // Verwijder URLs
  text = text.replace(/https?:\/\/[^\s<>"]+/gi, '')
  
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
  
  // Verwijder dubbele spaties en trim
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}