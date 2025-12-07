// app/api/npo/programs/route.ts
// @version 1.1.0
// Server-side API route voor NPO Backstage
// FIXED: Correcte API URL en request format
// Docs: http://backstage-docs.npo.nl/
// Examples: https://github.com/openstate/npo-backstage-examples

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

// Correcte API URL (niet backstage-api.npo.nl met /v0/)
const NPO_BACKSTAGE_URL = 'http://backstage-api.npo.nl/v0'

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
    // NPO Backstage API request format (ElasticSearch-based)
    // Zoek in de 'metadata' index
    const searchUrl = `${NPO_BACKSTAGE_URL}/metadata/search`
    
    // ElasticSearch-style query
    const requestBody: any = {
      size: limit,
      sort: [{ sortdate: { order: 'desc' } }]
    }

    // Query opbouwen
    const mustClauses: any[] = []
    
    // Datum range filter
    if (dateFrom && dateTo) {
      mustClauses.push({
        range: {
          sortdate: {
            gte: dateFrom,
            lte: dateTo
          }
        }
      })
    }
    
    // Zoekterm filter
    if (search) {
      mustClauses.push({
        match: {
          'titles.title': search
        }
      })
    }

    if (mustClauses.length > 0) {
      requestBody.query = {
        bool: {
          must: mustClauses
        }
      }
    }

    console.log(`[NPO] Searching: ${searchUrl}`)
    console.log(`[NPO] Request body:`, JSON.stringify(requestBody))

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      next: { revalidate: 86400 }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[NPO] API error: ${response.status} - ${errorText}`)
      
      // Return empty result zodat frontend niet crasht
      return NextResponse.json({
        error: `NPO Backstage API error: ${response.status}`,
        programs: [],
        totalResults: 0,
        dateRange: { from: dateFrom || '', to: dateTo || '' }
      })
    }

    const data = await response.json()

    // Transform NPO response naar onze interface
    // NPO Backstage returns hits in ElasticSearch format
    const hits = data.hits?.hits || data.results || []
    
    const programs: NPOProgram[] = hits.map((hit: any) => {
      const source = hit._source || hit
      
      // Extract title - kan in verschillende formats zitten
      let title = 'Onbekend'
      if (source.titles && Array.isArray(source.titles) && source.titles.length > 0) {
        title = source.titles[0].title || source.titles[0]
      } else if (source.title) {
        title = source.title
      } else if (source.maintitles && source.maintitles.length > 0) {
        title = source.maintitles[0]
      }

      // Extract broadcast date
      let broadcastDate = ''
      if (source.sortdate) {
        broadcastDate = source.sortdate
      } else if (source.broadcasters && source.broadcasters.length > 0) {
        broadcastDate = source.broadcasters[0].start || ''
      }

      // Extract channel/broadcaster
      let channel = null
      if (source.broadcasters && Array.isArray(source.broadcasters)) {
        channel = source.broadcasters[0]?.name || source.broadcasters[0]
      }

      // Extract categories/genres
      let categories: string[] = []
      if (source.genres && Array.isArray(source.genres)) {
        categories = source.genres.map((g: any) => g.term || g)
      }

      return {
        prid: source.prid || hit._id || '',
        title,
        description: source.descriptions?.[0]?.description || source.description || null,
        broadcastDate,
        channel,
        categories,
        duration: source.duration || null,
        imageUrl: source.images?.[0]?.url || null
      }
    })

    console.log(`[NPO] Found ${data.hits?.total || programs.length} programs, returning ${programs.length}`)

    return NextResponse.json({
      programs,
      totalResults: data.hits?.total || programs.length,
      dateRange: { from: dateFrom || '', to: dateTo || '' }
    })

  } catch (error) {
    console.error('[NPO] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to fetch NPO data',
      programs: [],
      totalResults: 0,
      dateRange: { from: dateFrom || '', to: dateTo || '' }
    })
  }
}