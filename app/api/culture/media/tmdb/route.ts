// app/api/culture/media/tmdb/route.ts
// @version 1.1.0
// Server-side API route voor TMDB film en series data
// Verbergt API key en handelt requests af

import { NextRequest, NextResponse } from 'next/server'
import { withApiCache } from '@/lib/apiCache'

const API_VERSION = '1.2.0'

interface TMDBMovie {
  id: number
  title: string
  original_title: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  popularity: number
  vote_average: number
  vote_count: number
  genre_ids: number[]
}

interface TMDBSeries {
  id: number
  name: string
  original_name: string
  first_air_date: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  popularity: number
  vote_average: number
  vote_count: number
  genre_ids: number[]
}

interface TMDBResponse {
  page: number
  results: TMDBMovie[] | TMDBSeries[]
  total_pages: number
  total_results: number
}

// TMDB API key - moet als environment variable worden gezet
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * GET /api/culture/media/tmdb
 * Parameters:
 * - type: 'movies' of 'series' (default: movies)
 * - from: start datum (YYYY-MM-DD)
 * - to: eind datum (YYYY-MM-DD)
 * - year: alleen content van dit jaar (alternatief voor from/to)
 * - limit: maximum aantal resultaten (default: 20)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'movies'
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const year = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  // Valideer type
  if (type !== 'movies' && type !== 'series') {
    return NextResponse.json(
      { error: 'Invalid type. Use "movies" or "series"' },
      { status: 400 }
    )
  }

  // Check API key
  if (!TMDB_API_KEY) {
    console.error('[TMDB] No API key configured')
    return NextResponse.json(
      { error: 'TMDB API key not configured' },
      { status: 500 }
    )
  }

  try {
    let url: string
    const endpoint = type === 'movies' ? 'discover/movie' : 'discover/tv'
    const dateField = type === 'movies' ? 'primary_release' : 'first_air'
    
    if (year) {
      // Content van een specifiek jaar, gesorteerd op populariteit
      const params: Record<string, string> = {
        api_key: TMDB_API_KEY,
        language: 'nl-NL',
        region: 'NL',
        sort_by: 'popularity.desc',
        'vote_count.gte': '100',
        page: '1'
      }
      
      if (type === 'movies') {
        params['primary_release_year'] = year
      } else {
        params['first_air_date_year'] = year
      }
      
      url = `${TMDB_BASE_URL}/${endpoint}?` + new URLSearchParams(params)
      
    } else if (from && to) {
      // Content binnen een datum range
      const params: Record<string, string> = {
        api_key: TMDB_API_KEY,
        language: 'nl-NL',
        region: 'NL',
        sort_by: 'popularity.desc',
        [`${dateField}_date.gte`]: from,
        [`${dateField}_date.lte`]: to,
        page: '1'
      }
      
      // Voor films: filter op theatrical release
      if (type === 'movies') {
        params['with_release_type'] = '2|3' // 2=limited, 3=theatrical
      }
      
      url = `${TMDB_BASE_URL}/${endpoint}?` + new URLSearchParams(params)
      
    } else {
      return NextResponse.json(
        { error: 'Missing required parameters: from/to or year' },
        { status: 400 }
      )
    }

    const fetchFromTmdb = async () => {
      console.log(`[TMDB] Fetching ${type}: ${url.replace(TMDB_API_KEY, '***')}`)

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 86400 } // Cache 24 uur
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[TMDB] API error: ${response.status} - ${errorText}`)
        return { error: `TMDB API error: ${response.status}`, status: response.status }
      }

      const data: TMDBResponse = await response.json()

      // Transform naar onze interface en limiteer resultaten
      let items: any[]

      if (type === 'movies') {
        items = (data.results as TMDBMovie[]).slice(0, limit).map(movie => ({
          id: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          releaseDate: movie.release_date,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          overview: movie.overview,
          popularity: movie.popularity,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          genreIds: movie.genre_ids
        }))
      } else {
        items = (data.results as TMDBSeries[]).slice(0, limit).map(series => ({
          id: series.id,
          title: series.name,
          originalTitle: series.original_name,
          releaseDate: series.first_air_date,
          posterPath: series.poster_path,
          backdropPath: series.backdrop_path,
          overview: series.overview,
          popularity: series.popularity,
          voteAverage: series.vote_average,
          voteCount: series.vote_count,
          genreIds: series.genre_ids
        }))
      }

      console.log(`[TMDB] Found ${data.total_results} ${type}, returning ${items.length}`)

      // Gebruik 'movies' als key voor backwards compatibility, ook voor series
      return {
        movies: items,
        type,
        totalResults: data.total_results,
        page: data.page,
        totalPages: data.total_pages,
        apiVersion: API_VERSION
      }
    }

    // Supabase cache-laag: historische periodes veranderen niet meer.
    const { data: payload } = await withApiCache({
      endpoint: 'tmdb',
      key: `${type}:${year ?? `${from}_${to}`}:${limit}`,
      date: from ?? (year ? `${year}-01-01` : null),
      fetcher: fetchFromTmdb,
      shouldCache: (result) => !('error' in result) && result.movies.length > 0,
    })

    if ('error' in payload) {
      return NextResponse.json({ error: payload.error }, { status: payload.status ?? 500 })
    }

    return NextResponse.json(payload)

  } catch (error) {
    console.error('[TMDB] Error:', error)
    return NextResponse.json(
      { error: `Failed to fetch ${type}` },
      { status: 500 }
    )
  }
}