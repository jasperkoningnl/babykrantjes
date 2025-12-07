// lib/tvOnDateAPI.ts
// @version 1.1.0
// Client voor TV programma's op een specifieke datum
// Vervangt npoBackstageAPI en wikipediaTVAPI

export interface TVProgram {
  title: string
  episodeTitle: string | null
  description: string | null
  broadcaster: string | null
  channel: string | null
  imageUrl: string | null
  sourceUrl: string | null
}

export interface TVOnDateResult {
  programs: TVProgram[]
  date: string
  totalFound: number
  source: string
  sourceUrl: string
  apiVersion?: string
  error?: string
}

/**
 * Haalt TV programma's op voor een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 * @param limit - Maximum aantal programma's (default: 10)
 */
export async function getTVProgramsOnDate(
  date: string,
  limit: number = 100
): Promise<TVOnDateResult> {
  const emptyResult: TVOnDateResult = {
    programs: [],
    date,
    totalFound: 0,
    source: 'uitzendinggemist.net',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/tv/on-date?date=${date}&limit=${limit}`)
    if (!response.ok) return emptyResult
    return await response.json()
  } catch (error) {
    console.error('[TVOnDate] Error:', error)
    return emptyResult
  }
}

/**
 * Formatteert een TV programma voor weergave
 */
export function formatTVProgram(program: TVProgram): string {
  let result = program.title
  if (program.episodeTitle) {
    result += ` - ${program.episodeTitle}`
  }
  if (program.channel) {
    result += ` (${program.channel})`
  } else if (program.broadcaster) {
    result += ` (${program.broadcaster})`
  }
  return result
}

/**
 * Filtert programma's op interessante content (geen nieuws/weer)
 */
export function filterInterestingPrograms(programs: TVProgram[]): TVProgram[] {
  const boringPatterns = [
    /^nos journaal/i,
    /^rtl nieuws/i,
    /^rtl weer/i,
    /journaal/i,
    /weer$/i,
    /^reclame/i,
    /tekst-tv/i
  ]
  
  return programs.filter(p => 
    !boringPatterns.some(pattern => pattern.test(p.title))
  )
}