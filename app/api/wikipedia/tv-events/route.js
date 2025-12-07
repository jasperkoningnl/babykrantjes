// app/api/wikipedia/tv-events/route.ts
// @version 1.0.0
// Scraper voor Wikipedia Dutch television events per jaar
// Bron: https://en.wikipedia.org/wiki/{year}_in_Dutch_television

import { NextRequest, NextResponse } from 'next/server'

interface TVEvent {
  date: string        // "5 March", "14 May", etc.
  month: number       // 1-12
  day: number         // 1-31
  description: string
  links: string[]     // Wikipedia links mentioned
}

interface WikipediaTVResult {
  events: TVEvent[]
  year: number
  source: string
  sourceUrl: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const yearParam = searchParams.get('year')
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null
  const day = searchParams.get('day') ? parseInt(searchParams.get('day')!, 10) : null

  if (!yearParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: year' },
      { status: 400 }
    )
  }

  const year = parseInt(yearParam, 10)
  
  if (year < 1950 || year > new Date().getFullYear()) {
    return NextResponse.json(
      { error: 'Year must be between 1950 and current year' },
      { status: 400 }
    )
  }

  try {
    const url = `https://en.wikipedia.org/wiki/${year}_in_Dutch_television`
    console.log(`[WikiTV] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html'
      },
      next: { revalidate: 86400 * 7 } // Cache 1 week
    })

    if (!response.ok) {
      console.error(`[WikiTV] HTTP ${response.status}`)
      return NextResponse.json({
        events: [],
        year,
        source: 'Wikipedia',
        sourceUrl: url,
        error: `Page not found for ${year}`
      })
    }

    const html = await response.text()
    let result = parseWikipediaTV(html, year, url)

    // Filter op maand/dag indien opgegeven
    if (month !== null || day !== null) {
      result.events = result.events.filter(event => {
        if (month !== null && event.month !== month) return false
        if (day !== null && event.day !== day) return false
        return true
      })
    }

    console.log(`[WikiTV] Found ${result.events.length} events for ${year}`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[WikiTV] Error:', error)
    return NextResponse.json({
      events: [],
      year,
      source: 'Wikipedia',
      sourceUrl: '',
      error: 'Failed to fetch Wikipedia data'
    })
  }
}

function parseWikipediaTV(html: string, year: number, sourceUrl: string): WikipediaTVResult {
  const result: WikipediaTVResult = {
    events: [],
    year,
    source: 'Wikipedia',
    sourceUrl
  }

  try {
    // Wikipedia events zijn in list format:
    // - 5 March – Description with [links]
    // Pattern: dag maand – beschrijving
    
    const monthNames: Record<string, number> = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12
    }

    // Zoek naar list items met datum patroon
    // Format: "- 5 March – " of "* 5 March – "
    const eventPattern = /[-*]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+[–—-]\s+([^\n\[\]]+(?:\[[^\]]*\][^\n\[\]]*)*)/gi

    let match
    while ((match = eventPattern.exec(html)) !== null) {
      const day = parseInt(match[1], 10)
      const monthName = match[2].toLowerCase()
      const month = monthNames[monthName] || 0
      let description = match[3].trim()

      // Clean up description
      // Remove markdown links but keep text: [text](url) -> text
      description = description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove reference markers like [[1]], [[2]]
      description = description.replace(/\[\[\d+\]\]/g, '')
      // Remove cite markers
      description = description.replace(/\[\d+\]/g, '')
      // Clean up extra whitespace
      description = description.replace(/\s+/g, ' ').trim()

      // Extract Wikipedia links
      const links: string[] = []
      const linkPattern = /\[([^\]]+)\]\((https:\/\/en\.wikipedia\.org[^)]+)\)/g
      let linkMatch
      while ((linkMatch = linkPattern.exec(match[3])) !== null) {
        links.push(linkMatch[2])
      }

      if (day > 0 && month > 0 && description.length > 10) {
        result.events.push({
          date: `${day} ${match[2]}`,
          month,
          day,
          description,
          links
        })
      }
    }

    // Sorteer op datum
    result.events.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month
      return a.day - b.day
    })

  } catch (error) {
    console.error('[WikiTV] Parse error:', error)
  }

  return result
}