// app/api/tmdb/movies/route.ts
// @version 1.0.0
// Server-side API route voor TMDB film data
// Verbergt API key en handelt requests af

import { NextRequest, NextResponse } from 'next/server'

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

interface TMDBResponse {
  page: number
  results: TMDBMovie[]
  total_pages: number
  total_results: number
}

// TMDB API key - moet als environment variable worden gezet
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * GET /api/tmdb/movies
 * Parameters:
 * - from: start datum (YYYY-MM-DD)
 * - to: eind datum (YYYY-MM-DD)
 * - year: alleen films van dit jaar (alternatief voor from/to)
 * - limit: maximum aantal resultaten (default: 20)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const year = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

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
    
    if (year) {
      // Films van een specifiek jaar, gesorteerd op populariteit
      url = `${TMDB_BASE_URL}/discover/movie?` + new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'nl-NL',
        region: 'NL',
        sort_by: 'popularity.desc',
        'primary_release_year': year,
        'vote_count.gte': '100', // Filter voor betrouwbare ratings
        page: '1'
      })
    } else if (from && to) {
      // Films binnen een datum range (theatrale releases in NL)
      url = `${TMDB_BASE_URL}/discover/movie?` + new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'nl-NL',
        region: 'NL',
        sort_by: 'popularity.desc',
        'release_date.gte': from,
        'release_date.lte': to,
        'with_release_type': '2|3', // 2=limited, 3=theatrical
        page: '1'
      })
    } else {
      return NextResponse.json(
        { error: 'Missing required parameters: from/to or year' },
        { status: 400 }
      )
    }

    console.log(`[TMDB] Fetching: ${url.replace(TMDB_API_KEY, '***')}`)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 86400 } // Cache 24 uur
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[TMDB] API error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `TMDB API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data: TMDBResponse = await response.json()

    // Transform naar onze interface en limiteer resultaten
    const movies = data.results.slice(0, limit).map(movie => ({
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

    console.log(`[TMDB] Found ${data.total_results} movies, returning ${movies.length}`)

    return NextResponse.json({
      movies,
      totalResults: data.total_results,
      page: data.page,
      totalPages: data.total_pages
    })

  } catch (error) {
    console.error('[TMDB] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch movies' },
      { status: 500 }
    )
  }
}