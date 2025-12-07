// app/api/tv/on-date/route.ts
// @version 1.0.0
// TV programma's op een specifieke datum
// Bron: uitzendinggemist.net

import { NextResponse } from 'next/server'

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD format
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Parse date and format for uitzendinggemist.net (DDMMYYYY)
  const dateParts = dateParam.split('-')
  if (dateParts.length !== 3) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }
  
  const [year, month, day] = dateParts
  const formattedDate = `${day}${month}${year}` // DDMMYYYY

  try {
    const url = `https://www.uitzendinggemist.net/op/${formattedDate}.html`
    console.log(`[TVOnDate] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      next: { revalidate: 86400 * 30 } // Cache 30 dagen (historische data verandert niet)
    })

    if (!response.ok) {
      console.error(`[TVOnDate] HTTP ${response.status}`)
      return NextResponse.json({
        programs: [],
        date: dateParam,
        source: 'uitzendinggemist.net',
        sourceUrl: url,
        error: `No data found for ${dateParam}`
      })
    }

    const html = await response.text()
    const programs = parseUitzendingGemist(html, limit)

    console.log(`[TVOnDate] Found ${programs.length} programs for ${dateParam}`)

    return NextResponse.json({
      programs,
      date: dateParam,
      totalFound: programs.length,
      source: 'uitzendinggemist.net',
      sourceUrl: url
    })

  } catch (error) {
    console.error('[TVOnDate] Error:', error)
    return NextResponse.json({
      programs: [],
      date: dateParam,
      source: 'uitzendinggemist.net',
      sourceUrl: '',
      error: 'Failed to fetch TV data'
    })
  }
}

function parseUitzendingGemist(html, limit) {
  const programs = []
  const seen = new Set()

  try {
    // De HTML bevat programma's in dit patroon (markdown-converted):
    // ### [Programma Naam](url "title")
    // [![alt](image-url)](link)
    // Aflevering Titel
    // Beschrijving...
    // DD-MM-YYYY
    // OMROEP
    // [Alle afleveringen bekijken](url)
    // [![Zender](zender-image)](zender-link)

    // Split op "### [" om programma blokken te vinden
    const blocks = html.split('### [')
    
    for (let i = 1; i < blocks.length && programs.length < limit; i++) {
      const block = blocks[i]
      
      // Haal programmanaam uit eerste regel
      const titleMatch = block.match(/^([^\]]+)\]\(([^)]+)/)
      if (!titleMatch) continue
      
      const title = titleMatch[1].trim()
      const programUrl = titleMatch[2].split('"')[0].trim()
      
      // Skip navigatie/datum links
      if (title.match(/^\d+\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i) ||
          title.match(/^\d+\s+(Januari|Februari|Maart|April|Mei|Juni|Juli|Augustus|September|Oktober|November|December)/i) ||
          title.length < 3) {
        continue
      }
      
      // Haal aflevering titel (regel na de afbeelding link)
      const episodeMatch = block.match(/\)\]\([^)]+\)\n\n([^\n]+)/)
      let episodeTitle = episodeMatch ? episodeMatch[1].trim() : null
      
      // Soms is episodeTitle hetzelfde als title
      if (episodeTitle === title) episodeTitle = null
      
      // Haal beschrijving (langere tekst na episodetitel)
      const lines = block.split('\n').filter(l => l.trim())
      let description = null
      for (const line of lines) {
        const trimmed = line.trim()
        // Beschrijving is meestal 50+ karakters en begint met hoofdletter
        if (trimmed.length > 50 && 
            trimmed.match(/^[A-Z]/) && 
            !trimmed.startsWith('[![') &&
            !trimmed.startsWith('[Alle') &&
            !trimmed.match(/^\d{2}-\d{2}-\d{4}/)) {
          description = trimmed
          break
        }
      }
      
      // Haal omroep (staat vaak alleen op een regel, uppercase start)
      const broadcasterMatch = block.match(/\n([A-Z][A-Z0-9a-z]{1,15})\n/)
      const broadcaster = broadcasterMatch ? broadcasterMatch[1] : null
      
      // Haal zender uit de zender afbeelding alt text
      const channelMatch = block.match(/!\[(Nederland \d|RTL \d|SBS \d|NET \d|Veronica)\]/)
      const channel = channelMatch ? channelMatch[1] : null
      
      // Haal afbeelding URL
      const imageMatch = block.match(/\[!\[[^\]]*\]\(([^)]+)\)/)
      let imageUrl = imageMatch ? imageMatch[1] : null
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = null
      }
      
      // Maak unieke key om duplicaten te voorkomen
      const key = `${title}|${episodeTitle || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      
      programs.push({
        title,
        episodeTitle,
        description: description ? description.substring(0, 200) : null,
        broadcaster,
        channel,
        imageUrl,
        sourceUrl: programUrl.startsWith('http') ? programUrl : 
                   `https://www.uitzendinggemist.net${programUrl}`
      })
    }

  } catch (error) {
    console.error('[TVOnDate] Parse error:', error)
  }

  return programs
}