// app/api/npo/programs/route.ts
// @version 1.0.0
// Server-side API route voor NPO Backstage
// Geen authenticatie nodig!

import { NextRequest, NextResponse } from 'next/server'

interface NPOProgram {
  prid: string
  title: string
  description: string | null
  broadcastDate: string
  channel: string | null
  categories: string[]
  duration: number | null
  imageUrl: string | null
}

const NPO_BACKSTAGE_URL = 'http://backstage-api.npo.nl/v0/metadata/search'

/**
 * GET /api/npo/programs
 * Parameters:
 * - from: start datum (YYYY-MM-DD)
 * - to: eind datum (YYYY-MM-DD)
 * - search: zoekterm voor titel
 * - date: enkele datum (alternatief voor from/to, zoekt ±7 dagen)
 * - limit: maximum resultaten (default: 20)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const date = searchParams.get('date')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  // Bepaal datum range
  let dateFrom: string
  let dateTo: string

  if (from && to) {
    dateFrom = from
    dateTo = to
  } else if (date) {
    const d = new Date(date)
    const fromDate = new Date(d)
    fromDate.setDate(d.getDate() - 7)
    const toDate = new Date(d)
    toDate.setDate(d.getDate() + 7)
    dateFrom = fromDate.toISOString().split('T')[0]
    dateTo = toDate.toISOString().split('T')[0]
  } else if (!search) {
    return NextResponse.json(
      { error: 'Missing required parameters: from/to, date, or search' },
      { status: 400 }
    )
  } else {
    // Alleen zoeken zonder datum - gebruik afgelopen jaar
    const now = new Date()
    const yearAgo = new Date(now)
    yearAgo.setFullYear(now.getFullYear() - 1)
    dateFrom = yearAgo.toISOString().split('T')[0]
    dateTo = now.toISOString().split('T')[0]
  }

  try {
    // Bouw de request body voor NPO Backstage API
    const requestBody: any = {
      filters: {
        broadcast_date: {
          range: {
            gte: dateFrom,
            lte: dateTo
          }
        }
      },
      size: limit,
      sort: [{ broadcast_date: 'desc' }]
    }

    // Voeg zoekterm toe indien aanwezig
    if (search) {
      requestBody.query = {
        match: {
          title: search
        }
      }
    }

    console.log(`[NPO] Searching programs from ${dateFrom} to ${dateTo}${search ? `, query: ${search}` : ''}`)

    const response = await fetch(NPO_BACKSTAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      next: { revalidate: 86400 } // Cache 24 uur
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[NPO] API error: ${response.status} - ${errorText}`)
      
      // NPO API kan soms unavailable zijn, geef duidelijke foutmelding
      return NextResponse.json(
        { 
          error: `NPO Backstage API error: ${response.status}`,
          programs: [],
          totalResults: 0,
          dateRange: { from: dateFrom, to: dateTo }
        },
        { status: 200 } // Return 200 met lege data zodat frontend niet crasht
      )
    }

    const data = await response.json()

    // Transform NPO response naar onze interface
    const programs: NPOProgram[] = (data.hits?.hits || []).map((hit: any) => {
      const source = hit._source || {}
      return {
        prid: source.prid || hit._id,
        title: source.title || 'Onbekend',
        description: source.description || null,
        broadcastDate: source.broadcast_date || source.sortdate || '',
        channel: source.broadcaster || source.channel || null,
        categories: source.categories || source.genres || [],
        duration: source.duration || null,
        imageUrl: source.image?.url || null
      }
    })

    console.log(`[NPO] Found ${data.hits?.total || 0} programs, returning ${programs.length}`)

    return NextResponse.json({
      programs,
      totalResults: data.hits?.total || 0,
      dateRange: { from: dateFrom, to: dateTo }
    })

  } catch (error) {
    console.error('[NPO] Error:', error)
    
    // Bij fout, return lege data zodat frontend blijft werken
    return NextResponse.json({
      error: 'Failed to fetch NPO data',
      programs: [],
      totalResults: 0,
      dateRange: { from: dateFrom || '', to: dateTo || '' }
    })
  }
}