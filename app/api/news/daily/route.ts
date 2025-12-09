// app/api/news/daily/route.ts
// @version 1.1.0
// Wikipedia Current Events scraper voor internationaal nieuws op een specifieke dag
// Bron: https://en.wikipedia.org/wiki/Portal:Current_events/{jaar}_{maand}_{dag}
// FIX: Betere cleaning van Wikipedia markup

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.1.0'

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
    // Gebruik normale Wikipedia URL (niet REST API) voor betere HTML structuur
    console.log(`[NewsDaily] Fetching: ${webUrl}`)

    const response = await fetch(webUrl, {
      headers: {
        'User-Agent': 'BabykrantBot/1.0 (educational project)',
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
    const events = parseCurrentEventsHtml(html)

    console.log(`[NewsDaily] Found ${events.length} events for ${dateParam}`)

    return NextResponse.json({
      date: dateParam,
      events,
      totalEvents: events.length,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: webUrl,
      apiVersion: API_VERSION
    })

  } catch (error) {
    console.error('[NewsDaily] Error:', error)
    return NextResponse.json({
      ...emptyResult,
      error: 'Failed to fetch news data'
    })
  }
}

function parseCurrentEventsHtml(html: string): NewsEvent[] {
  const events: NewsEvent[] = []
  const seenTexts = new Set<string>()

  try {
    // Zoek de content sectie
    const contentMatch = html.match(/<div[^>]*class="[^"]*current-events[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="(printfooter|catlinks)"|<\/td>)/i)
      || html.match(/<div[^>]*id="mw-content-text"[^>]*>([\s\S]*?)<\/div>\s*<div class="printfooter"/i)
    
    let contentHtml = contentMatch ? contentMatch[1] : html

    // Zoek naar categorieën (bold/strong headers of dt elementen)
    let currentCategory = 'Nieuws'
    
    // Parse de HTML structuur
    // Wikipedia Current Events gebruikt vaak: <p><b>Category</b></p> gevolgd door <ul><li>items</li></ul>
    
    // Methode 1: Zoek naar description lists (dl/dt/dd)
    const dlPattern = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
    let dlMatch
    while ((dlMatch = dlPattern.exec(contentHtml)) !== null) {
      const category = cleanWikiText(dlMatch[1])
      const content = dlMatch[2]
      
      if (category && category.length > 2 && category.length < 50) {
        currentCategory = category
      }
      
      // Parse list items in de dd
      const items = parseListItems(content, currentCategory)
      for (const item of items) {
        if (!seenTexts.has(item.text.toLowerCase())) {
          seenTexts.add(item.text.toLowerCase())
          events.push(item)
        }
      }
    }

    // Methode 2: Zoek naar bold headers gevolgd door lijsten
    const sectionPattern = /<(?:p|div)[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/(?:p|div)>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi
    let sectionMatch
    while ((sectionMatch = sectionPattern.exec(contentHtml)) !== null) {
      const category = cleanWikiText(sectionMatch[1])
      const listHtml = sectionMatch[2]
      
      if (category && category.length > 2 && category.length < 50) {
        currentCategory = category
      }
      
      const items = parseListItems(listHtml, currentCategory)
      for (const item of items) {
        if (!seenTexts.has(item.text.toLowerCase())) {
          seenTexts.add(item.text.toLowerCase())
          events.push(item)
        }
      }
    }

    // Methode 3: Directe ul/li parsing als fallback
    if (events.length === 0) {
      const listPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let listMatch
      while ((listMatch = listPattern.exec(contentHtml)) !== null && events.length < 30) {
        const text = cleanWikiText(listMatch[1])
        if (text.length > 30 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
          seenTexts.add(text.toLowerCase())
          events.push({
            category: 'Nieuws',
            text
          })
        }
      }
    }

  } catch (error) {
    console.error('[NewsDaily] Parse error:', error)
  }

  return events.slice(0, 25) // Max 25 items
}

function parseListItems(html: string, category: string): NewsEvent[] {
  const items: NewsEvent[] = []
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match
  
  while ((match = liPattern.exec(html)) !== null && items.length < 10) {
    // Skip nested lists
    const content = match[1].replace(/<ul[\s\S]*?<\/ul>/gi, '')
    const text = cleanWikiText(content)
    
    if (text.length > 30 && text.length < 500) {
      items.push({ category, text })
    }
  }
  
  return items
}

function cleanWikiText(html: string): string {
  let text = html
    // Verwijder HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Verwijder script/style tags
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Verwijder sup tags (referenties)
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
    // Converteer links: <a href="..." title="...">text</a> -> text
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    // Verwijder overige HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Verwijder Wikipedia [[link|display]] markup -> display
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    // Verwijder Wikipedia [[link]] markup -> link
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // Verwijder [ref] referenties
    .replace(/\[\d+\]/g, '')
    // Verwijder URLs
    .replace(/https?:\/\/[^\s\])]*/g, '')
    // Verwijder (bron) referenties aan het eind
    .replace(/\s*\([^)]*(?:Reuters|AP|BBC|AFP|News|Source|Times)[^)]*\)\s*$/i, '')
    // Verwijder lege haakjes
    .replace(/\(\s*\)/g, '')
    // Normaliseer whitespace
    .replace(/\s+/g, ' ')
    // Verwijder leading bullets/dashes
    .replace(/^[\s*•\-–—]+/, '')
    // Trim
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}