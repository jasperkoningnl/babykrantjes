// lib/tmdbAPI.ts
// @version 1.0.0
// TMDB API client voor films in Nederland rond een geboortedatum
// Documentatie: https://developer.themoviedb.org/docs

export interface Movie {
  id: number
  title: string
  originalTitle: string
  releaseDate: string
  posterPath: string | null
  backdropPath: string | null
  overview: string
  popularity: number
  voteAverage: number
  voteCount: number
  genreIds: number[]
}

export interface TMDBMoviesResult {
  movies: Movie[]
  totalResults: number
  birthDate: string
  dateRange: {
    from: string
    to: string
  }
  source: string
}

// Genre mapping voor TMDB
export const TMDB_GENRES: Record<number, string> = {
  28: 'Actie',
  12: 'Avontuur',
  16: 'Animatie',
  35: 'Komedie',
  80: 'Misdaad',
  99: 'Documentaire',
  18: 'Drama',
  10751: 'Familie',
  14: 'Fantasie',
  36: 'Historie',
  27: 'Horror',
  10402: 'Muziek',
  9648: 'Mysterie',
  10749: 'Romantiek',
  878: 'Sciencefiction',
  10770: 'TV-film',
  53: 'Thriller',
  10752: 'Oorlog',
  37: 'Western'
}

/**
 * Haalt films op die in Nederland in de bioscoop draaiden rond de geboortedatum
 * @param birthDate - Geboortedatum in YYYY-MM-DD formaat
 * @param daysRange - Aantal dagen voor en na de geboortedatum (default: 14)
 */
export async function getMoviesAroundDate(
  birthDate: string,
  daysRange: number = 14
): Promise<TMDBMoviesResult> {
  const emptyResult: TMDBMoviesResult = {
    movies: [],
    totalResults: 0,
    birthDate,
    dateRange: { from: '', to: '' },
    source: 'TMDB'
  }

  try {
    // Bereken datum range
    const date = new Date(birthDate)
    const fromDate = new Date(date)
    fromDate.setDate(date.getDate() - daysRange)
    const toDate = new Date(date)
    toDate.setDate(date.getDate() + daysRange)

    const from = fromDate.toISOString().split('T')[0]
    const to = toDate.toISOString().split('T')[0]

    // Roep onze API route aan
    const response = await fetch(
      `/api/culture/media/tmdb?type=movies&from=${from}&to=${to}`
    )

    if (!response.ok) {
      console.error(`[TMDB] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    
    return {
      movies: data.movies || [],
      totalResults: data.totalResults || 0,
      birthDate,
      dateRange: { from, to },
      source: 'TMDB'
    }

  } catch (error) {
    console.error('[TMDB] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt de top films op van een specifiek jaar
 * @param year - Het jaar
 * @param limit - Maximum aantal films (default: 10)
 */
export async function getTopMoviesOfYear(
  year: number,
  limit: number = 10
): Promise<TMDBMoviesResult> {
  const emptyResult: TMDBMoviesResult = {
    movies: [],
    totalResults: 0,
    birthDate: `${year}-01-01`,
    dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
    source: 'TMDB'
  }

  try {
    const response = await fetch(
      `/api/culture/media/tmdb?type=movies&year=${year}&limit=${limit}`
    )

    if (!response.ok) {
      console.error(`[TMDB] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    
    return {
      movies: data.movies || [],
      totalResults: data.totalResults || 0,
      birthDate: `${year}-01-01`,
      dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
      source: 'TMDB'
    }

  } catch (error) {
    console.error('[TMDB] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt populaire series op van een specifiek jaar
 * @param year - Het jaar
 * @param limit - Maximum aantal series (default: 10)
 */
export async function getSeriesOfYear(
  year: number,
  limit: number = 10
): Promise<TMDBMoviesResult> {
  const emptyResult: TMDBMoviesResult = {
    movies: [],
    totalResults: 0,
    birthDate: `${year}-01-01`,
    dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
    source: 'TMDB'
  }

  try {
    const response = await fetch(
      `/api/culture/media/tmdb?type=series&year=${year}&limit=${limit}`
    )

    if (!response.ok) {
      console.error(`[TMDB] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    
    return {
      movies: data.movies || [],
      totalResults: data.totalResults || 0,
      birthDate: `${year}-01-01`,
      dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
      source: 'TMDB'
    }

  } catch (error) {
    console.error('[TMDB] Error:', error)
    return emptyResult
  }
}

/**
 * Formatteert genres naar Nederlandse strings
 */
export function formatGenres(genreIds: number[]): string[] {
  return genreIds
    .map(id => TMDB_GENRES[id])
    .filter(Boolean)
}

/**
 * Genereert volledige poster URL
 */
export function getPosterUrl(posterPath: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
  if (!posterPath) return null
  return `https://image.tmdb.org/t/p/${size}${posterPath}`
}

/**
 * Genereert volledige backdrop URL
 */
export function getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'): string | null {
  if (!backdropPath) return null
  return `https://image.tmdb.org/t/p/${size}${backdropPath}`
}