// lib/wikipediaTVAPI.ts
// @version 1.0.0
// Wikipedia Dutch TV events client
// Haalt belangrijke TV-momenten op per jaar

export interface TVEvent {
  date: string
  month: number
  day: number
  description: string
  links: string[]
}

export interface WikipediaTVResult {
  events: TVEvent[]
  year: number
  source: string
  sourceUrl: string
  error?: string
}

/**
 * Haalt TV events op voor een specifiek jaar
 * @param year - Het jaar (1950 - heden)
 */
export async function getTVEventsForYear(year: number): Promise<WikipediaTVResult> {
  const emptyResult: WikipediaTVResult = {
    events: [],
    year,
    source: 'Wikipedia',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/wikipedia/tv-events?year=${year}`)
    if (!response.ok) return emptyResult
    return await response.json()
  } catch (error) {
    console.error('[WikiTV] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt TV events op rond een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 * @param daysRange - Aantal dagen voor en na (default: 30)
 */
export async function getTVEventsAroundDate(
  date: string,
  daysRange: number = 30
): Promise<WikipediaTVResult> {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()

  const result = await getTVEventsForYear(year)
  
  // Filter events binnen de range
  const targetDate = new Date(date)
  result.events = result.events.filter(event => {
    const eventDate = new Date(year, event.month - 1, event.day)
    const diffDays = Math.abs((eventDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= daysRange
  })

  return result
}

/**
 * Haalt TV events op voor een specifieke maand
 */
export async function getTVEventsForMonth(year: number, month: number): Promise<WikipediaTVResult> {
  const emptyResult: WikipediaTVResult = {
    events: [],
    year,
    source: 'Wikipedia',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/wikipedia/tv-events?year=${year}&month=${month}`)
    if (!response.ok) return emptyResult
    return await response.json()
  } catch (error) {
    console.error('[WikiTV] Error:', error)
    return emptyResult
  }
}

/**
 * Formatteert een TV event voor weergave
 */
export function formatTVEvent(event: TVEvent): string {
  return `${event.date}: ${event.description}`
}