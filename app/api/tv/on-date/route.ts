// app/api/tv/on-date/route.ts
// @version 1.0.0
// TV programma's op een specifieke datum
// Bron: uitzendinggemist.net

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

function parseUitzendingGemist(html: string, limit: number) {
  const programs: Array<{
    title: string
    episodeTitle: string | null
    description: string | null
    broadcaster: string | null
    channel: string | null
    imageUrl: string | null
    sourceUrl: string | null
  }> = []
  const seen = new Set<string>()

  try {
    // De HTML structuur per programma:
    // <div class="kr_blok_main">
    //   <h3 class="kr_blok_title"><a href="URL" title="TITLE">TITLE</a></h3>
    //   <div class="kr_blok_thumb"><a href="..."><img src="IMAGE" .../></a></div>
    //   <p class="kr_blok_subtitle">EPISODE</p>
    //   <p class="kr_blok_desc">DESCRIPTION</p>
    //   <p class="kr_blok_date">DD-MM-YYYY</p>
    //   <p class="kr_blok_host">BROADCASTER</p>
    //   <p class="icon"><a href="..."><img ... alt="CHANNEL" /></a></p>
    // </div>

    // Split op kr_blok_main om individuele programma's te krijgen
    const blocks = html.split('kr_blok_main')
    
    for (let i = 1; i < blocks.length && programs.length < limit; i++) {
      const block = blocks[i]
      
      // Titel: <h3 class="kr_blok_title"><a href="URL" title="TITLE">TITLE</a></h3>
      const titleMatch = block.match(/kr_blok_title[^>]*><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/)
      if (!titleMatch) continue
      
      const sourceUrl = titleMatch[1]
      const title = titleMatch[2].trim()
      
      // Skip als al gezien
      if (seen.has(title)) continue
      seen.add(title)
      
      // Aflevering: <p class="kr_blok_subtitle">EPISODE</p>
      const episodeMatch = block.match(/kr_blok_subtitle[^>]*>([^<]+)<\/p>/)
      let episodeTitle = episodeMatch ? episodeMatch[1].trim() : null
      // Skip als episode gelijk is aan titel
      if (episodeTitle === title) episodeTitle = null
      
      // Beschrijving: <p class="kr_blok_desc">DESCRIPTION</p>
      const descMatch = block.match(/kr_blok_desc[^>]*>([^<]+)<\/p>/)
      let description = descMatch ? descMatch[1].trim() : null
      // Clean HTML entities
      if (description) {
        description = description
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&aacute;/g, 'á')
          .replace(/&eacute;/g, 'é')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim()
        // Skip beschrijvingen die HTML tags bevatten
        if (description.includes('<') || description.length < 10) {
          description = null
        }
      }
      
      // Omroep: <p class="kr_blok_host">BROADCASTER</p>
      const broadcasterMatch = block.match(/kr_blok_host[^>]*>([^<]+)<\/p>/)
      const broadcaster = broadcasterMatch ? broadcasterMatch[1].trim() : null
      
      // Zender: <img ... alt="CHANNEL" /> in icon sectie
      const channelMatch = block.match(/class="icon"[^>]*>.*?alt="([^"]+)"/)
      const channel = channelMatch ? channelMatch[1].trim() : null
      
      // Afbeelding: <img src="IMAGE" in kr_blok_thumb
      const imageMatch = block.match(/kr_blok_thumb[^>]*>.*?<img\s+src="([^"]+)"/)
      const imageUrl = imageMatch ? imageMatch[1] : null
      
      programs.push({
        title,
        episodeTitle,
        description,
        broadcaster,
        channel,
        imageUrl,
        sourceUrl: sourceUrl.startsWith('http') ? sourceUrl : `https://www.uitzendinggemist.net${sourceUrl}`
      })
    }

  } catch (error) {
    console.error('[TVOnDate] Parse error:', error)
  }

  return programs
}