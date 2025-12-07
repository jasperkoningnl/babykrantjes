// lib/wikipediaTVAPI.ts
// @version 1.0.0
// Client voor Wikipedia Dutch television data per jaar

export interface TVEvent {
  date: string | null
  description: string
}

export interface TVShow {
  title: string
  years: string | null
  decade: string | null
}

export interface WikipediaTVResult {
  year: number
  events: TVEvent[]
  runningShows: TVShow[]
  debuts: string[]
  endings: string[]
  source: string
  sourceUrl: string
  apiVersion?: string
  error?: string
}

/**
 * Haalt Wikipedia TV data op voor een specifiek jaar
 * @param year - Jaar (bijv. 2012)
 */
export async function getWikipediaTVByYear(year: number): Promise<WikipediaTVResult> {
  const emptyResult: WikipediaTVResult = {
    year,
    events: [],
    runningShows: [],
    debuts: [],
    endings: [],
    source: 'Wikipedia',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/culture/tv/wikipedia?year=${year}`)
    if (!response.ok) return emptyResult
    return await response.json()
  } catch (error) {
    console.error('[WikipediaTV] Error:', error)
    return emptyResult
  }
}

/**
 * Formatteert een TV event voor weergave
 */
export function formatTVEvent(event: TVEvent): string {
  if (event.date) {
    return `${event.date}: ${event.description}`
  }
  return event.description
}

/**
 * Formatteert een TV show voor weergave
 */
export function formatTVShow(show: TVShow): string {
  if (show.years) {
    return `${show.title} (${show.years})`
  }
  return show.title
}