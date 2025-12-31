// app/api/tv/on-date/route.ts
// @version 2.0.0
// DRIELAAGSE STRATEGIE:
// - Layer 1: uitzendinggemist.net (tot 20 feb 2024)
// - Layer 2: kijkonderzoek.nl LIVE (vanaf vandaag tot 7 dagen geleden)
// - Layer 3: Wayback Machine (alles daartussen - coming soon)

const API_VERSION = '2.0.0'

import { NextRequest, NextResponse } from 'next/server'

// Datum cutoffs
const CUTOFF_UZG = new Date('2024-02-20T23:59:59') // Laatste datum met uitzendinggemist.net data

/**
 * Berekent aantal dagen geleden
 */
function calculateDaysAgo(dateString: string): number {
  const targetDate = new Date(dateString)
  const today = new Date()
  targetDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diffTime = today.getTime() - targetDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD format
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Parse date and validate format
  const dateParts = dateParam.split('-')
  if (dateParts.length !== 3) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const [year, month, day] = dateParts
  const requestDate = new Date(dateParam)
  requestDate.setHours(0, 0, 0, 0)

  console.log(`[TV API v${API_VERSION}] Request for ${dateParam}`)

  // ============================================================================
  // LAYER 1: uitzendinggemist.net (tot 20 feb 2024)
  // ============================================================================
  if (requestDate <= CUTOFF_UZG) {
    console.log(`[TV API] → Layer 1: uitzendinggemist.net (${dateParam} <= 2024-02-20)`)
    return await fetchFromUitzendingGemist(dateParam, day, month, year, limit)
  }

  // ============================================================================
  // LAYER 2: kijkonderzoek.nl LIVE (laatste week tot 7 dagen geleden)
  // ============================================================================
  const daysAgo = calculateDaysAgo(dateParam)
  if (daysAgo >= 0 && daysAgo <= 7) {
    console.log(`[TV API] → Layer 2: kijkonderzoek.nl LIVE (${daysAgo} days ago)`)

    try {
      // Intern fetch naar kijkonderzoek API
      const baseUrl = request.nextUrl.origin
      const response = await fetch(`${baseUrl}/api/culture/tv/kijkonderzoek?date=${dateParam}`)

      if (response.ok) {
        const data = await response.json()

        // Transform kijkonderzoek format to standard format
        return NextResponse.json({
          programs: data.programs.map((p: any) => ({
            title: p.title,
            episodeTitle: p.episodeTitle,
            description: p.description,
            broadcaster: p.broadcaster,
            channel: p.channel,
            imageUrl: p.imageUrl,
            sourceUrl: p.sourceUrl,
            time: p.time,
            ranking: p.ranking,
            viewerCount: p.viewerCount
          })),
          date: dateParam,
          totalFound: data.totalFound,
          source: 'kijkonderzoek.nl (live)',
          sourceUrl: data.sourceUrl,
          apiVersion: API_VERSION
        })
      }

      // Kijkonderzoek failed, fall through to Layer 3
      console.log(`[TV API] kijkonderzoek.nl failed (HTTP ${response.status}), falling back to Layer 3`)

    } catch (error) {
      console.error('[TV API] kijkonderzoek.nl error:', error)
      // Fall through to Layer 3
    }
  }

  // ============================================================================
  // LAYER 3: Wayback Machine (alles daartussen)
  // ============================================================================
  console.log(`[TV API] → Layer 3: Wayback Machine (${dateParam})`)

  // TODO: Implement Wayback Machine route
  // For now, return empty result with message
  return NextResponse.json({
    programs: [],
    date: dateParam,
    totalFound: 0,
    source: 'wayback-machine (not yet implemented)',
    sourceUrl: '',
    apiVersion: API_VERSION,
    error: `Wayback Machine support not yet implemented for ${dateParam}. This date falls between 2024-02-21 and ${daysAgo > 7 ? `${daysAgo} days ago` : '8+ days ago'}.`
  })
}

/**
 * Fetches from uitzendinggemist.net (Layer 1)
 * Original implementation preserved
 */
async function fetchFromUitzendingGemist(
  dateParam: string,
  day: string,
  month: string,
  year: string,
  limit: number
): Promise<NextResponse> {
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
      sourceUrl: url,
      apiVersion: API_VERSION
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
