// lib/dutchChartsAPI.ts
// @version 1.0.0
// DutchCharts.nl scraper voor jaaroverzichten en hitlijsten
// Bron: https://dutchcharts.nl (archief sinds 1956)

export interface YearChartEntry {
  position: number
  title: string
  artist: string
  peakPosition?: number
  weeksInChart?: number
}

export interface DutchChartsYearResult {
  entries: YearChartEntry[]
  year: number
  totalEntries: number
  source: string
  sourceUrl: string
}

export interface WeekChartResult {
  entries: YearChartEntry[]
  chartDate: string
  year: number
  source: string
  sourceUrl: string
}

/**
 * Haalt het jaaroverzicht op voor een specifiek jaar
 * @param year - Het jaar (1956 - heden)
 * @param limit - Maximum aantal entries (default: 20)
 */
export async function getYearOverview(
  year: number,
  limit: number = 20
): Promise<DutchChartsYearResult> {
  const emptyResult: DutchChartsYearResult = {
    entries: [],
    year,
    totalEntries: 0,
    source: 'DutchCharts.nl',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/culture/music/dutchcharts?year=${year}&limit=${limit}`)

    if (!response.ok) {
      console.error(`[DutchCharts] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    return data as DutchChartsYearResult

  } catch (error) {
    console.error('[DutchCharts] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt de weekchart op voor een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getWeekChart(date: string): Promise<WeekChartResult> {
  const emptyResult: WeekChartResult = {
    entries: [],
    chartDate: date,
    year: new Date(date).getFullYear(),
    source: 'DutchCharts.nl',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/dutchcharts/week?date=${date}`)

    if (!response.ok) {
      console.error(`[DutchCharts] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    return data as WeekChartResult

  } catch (error) {
    console.error('[DutchCharts] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt unieke artiesten uit jaaroverzicht
 * @param year - Het jaar
 * @param limit - Maximum aantal artiesten
 */
export async function getPopularArtistsOfYear(
  year: number,
  limit: number = 10
): Promise<string[]> {
  const yearData = await getYearOverview(year, 50)
  
  // Extract unieke artiesten, behoud volgorde (populairst eerst)
  const artists: string[] = []
  const seen = new Set<string>()
  
  for (const entry of yearData.entries) {
    const artistLower = entry.artist.toLowerCase()
    if (!seen.has(artistLower)) {
      seen.add(artistLower)
      artists.push(entry.artist)
      if (artists.length >= limit) break
    }
  }
  
  return artists
}

/**
 * Formatteert jaar entry voor weergave
 */
export function formatYearEntry(entry: YearChartEntry): string {
  return `${entry.position}. ${entry.artist} - "${entry.title}"`
}