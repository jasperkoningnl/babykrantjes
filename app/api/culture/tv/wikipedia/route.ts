// app/api/culture/tv/wikipedia/route.ts
// @version 1.0.0
// Wikipedia scraper voor Dutch television events per jaar
// Bron: https://en.wikipedia.org/wiki/{year}_in_Dutch_television

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const year = searchParams.get('year')

  if (!year) {
    return NextResponse.json(
      { error: 'Missing required parameter: year' },
      { status: 400 }
    )
  }

  const yearNum = parseInt(year, 10)
  if (isNaN(yearNum) || yearNum < 1950 || yearNum > new Date().getFullYear()) {
    return NextResponse.json(
      { error: 'Invalid year. Must be between 1950 and current year.' },
      { status: 400 }
    )
  }

  try {
    const url = `https://en.wikipedia.org/wiki/${year}_in_Dutch_television`
    console.log(`[WikipediaTV] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html'
      },
      next: { revalidate: 86400 * 30 } // Cache 30 dagen
    })

    if (!response.ok) {
      console.error(`[WikipediaTV] HTTP ${response.status}`)
      return NextResponse.json({
        year: yearNum,
        events: [],
        runningShows: [],
        debuts: [],
        endings: [],
        source: 'Wikipedia',
        sourceUrl: url,
        apiVersion: API_VERSION,
        error: `No Wikipedia page found for ${year}`
      })
    }

    const html = await response.text()
    const data = parseWikipediaTV(html, yearNum)

    console.log(`[WikipediaTV] Found ${data.events.length} events, ${data.runningShows.length} running shows for ${year}`)

    return NextResponse.json({
      ...data,
      year: yearNum,
      source: 'Wikipedia',
      sourceUrl: url,
      apiVersion: API_VERSION
    })

  } catch (error) {
    console.error('[WikipediaTV] Error:', error)
    return NextResponse.json({
      year: yearNum,
      events: [],
      runningShows: [],
      debuts: [],
      endings: [],
      source: 'Wikipedia',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'Failed to fetch Wikipedia data'
    })
  }
}

interface TVEvent {
  date: string | null
  description: string
}

interface TVShow {
  title: string
  years: string | null
  decade: string | null
}

interface WikipediaTVData {
  events: TVEvent[]
  runningShows: TVShow[]
  debuts: string[]
  endings: string[]
}

function parseWikipediaTV(html: string, year: number): WikipediaTVData {
  const events: TVEvent[] = []
  const runningShows: TVShow[] = []
  const debuts: string[] = []
  const endings: string[] = []

  try {
    // === EVENTS SECTION ===
    // Zoek naar de Events sectie en parse de lijst
    const eventsMatch = html.match(/id="Events"[\s\S]*?<ul>([\s\S]*?)<\/ul>/)
    if (eventsMatch) {
      const eventsList = eventsMatch[1]
      const eventItems = eventsList.match(/<li>[\s\S]*?<\/li>/g) || []
      
      for (const item of eventItems) {
        // Verwijder HTML tags maar behoud de tekst
        let text = item
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        
        // Probeer datum te extraheren (bijv. "20 January - ...")
        const dateMatch = text.match(/^(\d{1,2}\s+\w+)\s*[-–]\s*(.*)/)
        if (dateMatch) {
          events.push({
            date: dateMatch[1],
            description: dateMatch[2].trim()
          })
        } else if (text.length > 0) {
          events.push({
            date: null,
            description: text
          })
        }
      }
    }

    // === TELEVISION SHOWS SECTION (Running shows) ===
    // Parse shows per decennium (1950s, 1960s, etc.)
    const decades = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']
    
    for (const decade of decades) {
      const decadePattern = new RegExp(`id="${decade}"[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>`)
      const decadeMatch = html.match(decadePattern)
      
      if (decadeMatch) {
        const showsList = decadeMatch[1]
        const showItems = showsList.match(/<li>[\s\S]*?<\/li>/g) || []
        
        for (const item of showItems) {
          // Extract show title from link
          const titleMatch = item.match(/title="([^"]+)"[^>]*>([^<]+)<\/a>/)
          const title = titleMatch ? titleMatch[2].trim() : null
          
          // Extract years (bijv. "(1976–present)" of "(1990-2012)")
          const yearsMatch = item.match(/\((\d{4}[–-](?:present|\d{4}))\)/)
          const years = yearsMatch ? yearsMatch[1] : null
          
          if (title) {
            runningShows.push({
              title,
              years,
              decade
            })
          }
        }
      }
    }

    // === DEBUTS SECTION ===
    // Skip als sectie "empty" bevat
    const debutsSection = html.match(/id="Debuts"[\s\S]*?(?=<div class="mw-heading|$)/)
    if (debutsSection && !debutsSection[0].includes('empty')) {
      const debutsMatch = debutsSection[0].match(/<ul>([\s\S]*?)<\/ul>/)
      if (debutsMatch) {
        const debutItems = debutsMatch[1].match(/<li>[\s\S]*?<\/li>/g) || []
        for (const item of debutItems) {
          const titleMatch = item.match(/>([^<]+)<\/a>/)
          if (titleMatch) {
            debuts.push(titleMatch[1].trim())
          }
        }
      }
    }

    // === ENDING THIS YEAR SECTION ===
    // Skip als sectie "empty" bevat
    const endingsSection = html.match(/id="Ending_this_year"[\s\S]*?(?=<div class="mw-heading|$)/)
    if (endingsSection && !endingsSection[0].includes('empty')) {
      const endingsMatch = endingsSection[0].match(/<ul>([\s\S]*?)<\/ul>/)
      if (endingsMatch) {
        const endingItems = endingsMatch[1].match(/<li>[\s\S]*?<\/li>/g) || []
        for (const item of endingItems) {
          const titleMatch = item.match(/>([^<]+)<\/a>/)
          if (titleMatch) {
            endings.push(titleMatch[1].trim())
          }
        }
      }
    }

  } catch (error) {
    console.error('[WikipediaTV] Parse error:', error)
  }

  return { events, runningShows, debuts, endings }
}