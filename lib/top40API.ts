// lib/top40API.ts
// @version 1.0.0
// Top40.nl scraper voor Nederlandse hitlijsten
// Bron: https://www.top40.nl (sinds 1965)

export interface ChartEntry {
  position: number
  title: string
  artist: string
  weeksInChart?: number
  previousPosition?: number
}

export interface Top40Result {
  numberOne: ChartEntry | null
  topTen: ChartEntry[]
  chartDate: string
  weekNumber: number
  year: number
  source: string
  sourceUrl: string
}

/**
 * Haalt de Top 40 op voor een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getTop40ByDate(date: string): Promise<Top40Result> {
  const emptyResult: Top40Result = {
    numberOne: null,
    topTen: [],
    chartDate: date,
    weekNumber: 0,
    year: 0,
    source: 'Top40.nl',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/top40?date=${date}`)

    if (!response.ok) {
      console.error(`[Top40] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    return data as Top40Result

  } catch (error) {
    console.error('[Top40] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt de #1 hit op voor een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getNumberOneHit(date: string): Promise<ChartEntry | null> {
  const result = await getTop40ByDate(date)
  return result.numberOne
}

/**
 * Berekent het weeknummer voor een datum
 * ISO week number calculation
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Formatteert een chart entry voor weergave
 */
export function formatChartEntry(entry: ChartEntry): string {
  let result = `${entry.position}. ${entry.artist} - "${entry.title}"`
  if (entry.weeksInChart) {
    result += ` (${entry.weeksInChart} ${entry.weeksInChart === 1 ? 'week' : 'weken'} in lijst)`
  }
  return result
}