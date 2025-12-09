// app/api/news/daily/route.ts
// @version 1.3.0
// Wikipedia Current Events scraper voor internationaal nieuws op een specifieke dag
// Bron: https://en.wikipedia.org/wiki/Portal:Current_events/{jaar}_{maand}_{dag}
// FIX v1.3.0: Robuustere content extractie met meerdere fallbacks

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.3.0'

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
    contentMethod: string
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
    const { events, categoriesFound, contentMethod } = parseCurrentEventsHtml(html)

    console.log(`[NewsDaily v${API_VERSION}] Found ${events.length} events in ${categoriesFound.length} categories for ${dateParam} (method: ${contentMethod})`)

    return NextResponse.json({
      date: dateParam,
      events,
      totalEvents: events.length,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: webUrl,
      apiVersion: API_VERSION,
      debug: {
        categoriesFound,
        rawCategoryCount: categoriesFound.length,
        contentMethod
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

function parseCurrentEventsHtml(html: string): { events: NewsEvent[], categoriesFound: string[], contentMethod: string } {
  const events: NewsEvent[] = []
  const categoriesFound: string[] = []
  let contentMethod = 'none'

  try {
    // Probeer verschillende methodes om de content te vinden
    let contentHtml = ''
    
    // Methode 1: Zoek specifiek naar current-events-content description div
    const method1 = html.match(/<div\s+class="current-events-content\s+description">([\s\S]*?)<\/div>\s*<\/div>/i)
    if (method1) {
      contentHtml = method1[1]
      contentMethod = 'current-events-content'
      console.log('[NewsDaily] Found content via method 1 (current-events-content)')
    }
    
    // Methode 2: Zoek naar current-events-content (zonder description)
    if (!contentHtml) {
      const method2 = html.match(/<div\s+class="current-events-content[^"]*">([\s\S]*?)<\/div>\s*<div\s+class="current-events-nav/i)
      if (method2) {
        contentHtml = method2[1]
        contentMethod = 'current-events-content-nav'
        console.log('[NewsDaily] Found content via method 2 (current-events-content-nav)')
      }
    }
    
    // Methode 3: Zoek in mw-parser-output, stop bij printfooter of catlinks
    if (!contentHtml) {
      const method3 = html.match(/<div class="mw-content-ltr mw-parser-output"[^>]*>([\s\S]*?)(?:<div class="printfooter"|<div id="catlinks")/i)
      if (method3) {
        contentHtml = method3[1]
        contentMethod = 'mw-parser-output'
        console.log('[NewsDaily] Found content via method 3 (mw-parser-output)')
      }
    }
    
    // Methode 4: Zoek in bodyContent
    if (!contentHtml) {
      const method4 = html.match(/<div id="bodyContent"[^>]*>([\s\S]*?)<div class="printfooter"/i)
      if (method4) {
        contentHtml = method4[1]
        contentMethod = 'bodyContent'
        console.log('[NewsDaily] Found content via method 4 (bodyContent)')
      }
    }

    if (!contentHtml) {
      console.log('[NewsDaily] Could not find content section with any method')
      return { events, categoriesFound, contentMethod: 'none' }
    }

    console.log(`[NewsDaily] Content length: ${contentHtml.length} chars`)

    // Wikipedia structuur:
    // <p><b>Armed conflicts and attacks</b></p>
    // <ul><li>Item 1</li></ul>
    // OF:
    // <p><b>Armed conflicts and attacks</b>
    // </p>
    // <ul><li>Item 1</li></ul>

    // Probeer eerst de primaire regex
    parseWithCategoryPattern(contentHtml, events, categoriesFound)

    // Als dat niet werkt, probeer alternatieve methode
    if (events.length === 0) {
      console.log('[NewsDaily] Primary pattern failed, trying split method')
      parseWithSplitMethod(contentHtml, events, categoriesFound)
    }

    // Als dat ook niet werkt, probeer bold-headers te vinden
    if (events.length === 0) {
      console.log('[NewsDaily] Split method failed, trying bold header method')
      parseWithBoldHeaders(contentHtml, events, categoriesFound)
    }

  } catch (error) {
    console.error('[NewsDaily] Parse error:', error)
  }

  return { events, categoriesFound, contentMethod }
}

function parseWithCategoryPattern(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  // Pattern: <p><b>Category</b></p> gevolgd door <ul>...</ul>
  // Met mogelijke whitespace/newlines
  const categoryPattern = /<p>\s*<b>([^<]+)<\/b>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/gi
  
  let match
  while ((match = categoryPattern.exec(contentHtml)) !== null) {
    const categoryName = cleanText(match[1])
    const ulContent = match[2]
    
    if (!categoryName || categoryName.length < 2 || categoryName.length > 80) continue
    
    categoriesFound.push(categoryName)
    
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
}

function parseWithSplitMethod(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  // Split op <p><b> of <p> <b>
  const sections = contentHtml.split(/<p>\s*<b>/i)
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i]
    
    // Extract category name (tot </b>)
    const categoryEndIndex = section.indexOf('</b>')
    if (categoryEndIndex === -1) continue
    
    const categoryName = cleanText(section.substring(0, categoryEndIndex))
    if (!categoryName || categoryName.length < 2 || categoryName.length > 80) continue
    
    // Check dat het een echte categorie is (geen sub-heading)
    const lowerCat = categoryName.toLowerCase()
    if (lowerCat.includes('see also') || lowerCat.includes('references')) continue
    
    categoriesFound.push(categoryName)
    
    // Zoek de <ul> na de category header
    const ulMatch = section.match(/<\/p>\s*<ul>([\s\S]*?)<\/ul>/i)
    if (!ulMatch) {
      // Probeer ook zonder </p>
      const ulMatch2 = section.match(/<ul>([\s\S]*?)<\/ul>/i)
      if (!ulMatch2) continue
      
      const items = parseListItems(ulMatch2[1])
      for (const itemText of items) {
        if (itemText.length > 10) {
          events.push({ category: categoryName, text: itemText })
        }
      }
      continue
    }
    
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

function parseWithBoldHeaders(contentHtml: string, events: NewsEvent[], categoriesFound: string[]): void {
  // Zoek alle <b>Category</b> gevolgd door content
  const boldPattern = /<b>([^<]{3,60})<\/b>/gi
  const knownCategories = [
    'armed conflicts', 'attacks', 'business', 'economy', 'disasters', 'accidents',
    'health', 'environment', 'international relations', 'law', 'crime',
    'politics', 'elections', 'science', 'technology', 'sport', 'arts', 'culture'
  ]
  
  let match
  let lastCategoryEnd = 0
  let currentCategory = ''
  
  while ((match = boldPattern.exec(contentHtml)) !== null) {
    const potentialCategory = cleanText(match[1]).toLowerCase()
    
    // Check of dit een bekende categorie lijkt
    const isCategory = knownCategories.some(kc => potentialCategory.includes(kc))
    
    if (isCategory) {
      // Als we al een categorie hadden, parse de content ertussen
      if (currentCategory && lastCategoryEnd > 0) {
        const betweenContent = contentHtml.substring(lastCategoryEnd, match.index)
        const ulMatch = betweenContent.match(/<ul>([\s\S]*?)<\/ul>/i)
        if (ulMatch) {
          const items = parseListItems(ulMatch[1])
          for (const itemText of items) {
            if (itemText.length > 10) {
              events.push({ category: currentCategory, text: itemText })
            }
          }
        }
      }
      
      currentCategory = cleanText(match[1])
      categoriesFound.push(currentCategory)
      lastCategoryEnd = match.index + match[0].length
    }
  }
  
  // Parse content na de laatste categorie
  if (currentCategory && lastCategoryEnd > 0) {
    const remainingContent = contentHtml.substring(lastCategoryEnd)
    const ulMatch = remainingContent.match(/<ul>([\s\S]*?)<\/ul>/i)
    if (ulMatch) {
      const items = parseListItems(ulMatch[1])
      for (const itemText of items) {
        if (itemText.length > 10) {
          events.push({ category: currentCategory, text: itemText })
        }
      }
    }
  }
}

function parseListItems(ulContent: string): string[] {
  const items: string[] = []
  const seen = new Set<string>()
  
  // Simpele aanpak: splits op </li> en parse elke sectie
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
    
    // Filter duplicaten en te korte items
    if (cleanedText.length > 10 && !seen.has(cleanedText.toLowerCase())) {
      seen.add(cleanedText.toLowerCase())
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
  
  // Verwijder geneste <ul>...</ul> blokken maar behoud tekst
  text = text.replace(/<\/?ul[^>]*>/gi, ' ')
  text = text.replace(/<\/?li[^>]*>/gi, ' ')
  
  // Converteer <a> tags naar hun tekst (behoud de link tekst)
  text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
  
  // Verwijder overige HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Verwijder Wikipedia referentie nummers [1], [2], etc.
  text = text.replace(/\[\d+\]/g, '')
  
  // Verwijder source citations aan het eind (bv. "(BBC News)", "(Reuters)")
  text = text.replace(/\s*\([^)]*(?:News|Times|Post|Guardian|Reuters|AFP|AP|BBC|CNN|Forbes|Journal|Economist|Yahoo|Sky|RTÉ|Setanta)[^)]*\)\s*/gi, ' ')
  
  // Verwijder URLs
  text = text.replace(/https?:\/\/[^\s<>"]+/gi, '')
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&#91;/g, '[')
  text = text.replace(/&#93;/g, ']')
  text = text.replace(/&#160;/g, ' ')
  
  // Verwijder dubbele spaties en trim
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}