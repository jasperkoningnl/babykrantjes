// lib/npoBackstageAPI.ts
// @version 1.0.0
// NPO Backstage API client voor Nederlandse TV programma's
// Documentatie: http://backstage-docs.npo.nl/
// Geen authenticatie vereist!

export interface TVProgram {
  prid: string           // Program ID
  title: string
  description: string | null
  broadcastDate: string
  channel: string | null
  categories: string[]
  duration: number | null  // in seconden
  imageUrl: string | null
}

export interface NPOResult {
  programs: TVProgram[]
  totalResults: number
  dateRange: {
    from: string
    to: string
  }
  source: string
}

/**
 * Zoekt TV programma's rond een specifieke datum
 * @param date - Datum in YYYY-MM-DD formaat
 * @param daysRange - Aantal dagen voor en na (default: 7)
 */
export async function getTVProgramsAroundDate(
  date: string,
  daysRange: number = 7
): Promise<NPOResult> {
  const emptyResult: NPOResult = {
    programs: [],
    totalResults: 0,
    dateRange: { from: '', to: '' },
    source: 'NPO Backstage'
  }

  try {
    // Bereken datum range
    const d = new Date(date)
    const fromDate = new Date(d)
    fromDate.setDate(d.getDate() - daysRange)
    const toDate = new Date(d)
    toDate.setDate(d.getDate() + daysRange)

    const from = fromDate.toISOString().split('T')[0]
    const to = toDate.toISOString().split('T')[0]

    const response = await fetch(`/api/npo/programs?from=${from}&to=${to}`)

    if (!response.ok) {
      console.error(`[NPO] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    
    return {
      programs: data.programs || [],
      totalResults: data.totalResults || 0,
      dateRange: { from, to },
      source: 'NPO Backstage'
    }

  } catch (error) {
    console.error('[NPO] Error:', error)
    return emptyResult
  }
}

/**
 * Zoekt naar een specifiek programma op titel
 * @param title - Titel om te zoeken
 * @param date - Optionele datum om rond te zoeken
 */
export async function searchTVProgram(
  title: string,
  date?: string
): Promise<NPOResult> {
  const emptyResult: NPOResult = {
    programs: [],
    totalResults: 0,
    dateRange: { from: '', to: '' },
    source: 'NPO Backstage'
  }

  try {
    let url = `/api/npo/programs?search=${encodeURIComponent(title)}`
    if (date) {
      url += `&date=${date}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[NPO] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    return {
      programs: data.programs || [],
      totalResults: data.totalResults || 0,
      dateRange: data.dateRange || { from: '', to: '' },
      source: 'NPO Backstage'
    }

  } catch (error) {
    console.error('[NPO] Error:', error)
    return emptyResult
  }
}

/**
 * Haalt populaire/belangrijke programma's op voor een periode
 * Filtert op bekende shows en belangrijke uitzendingen
 */
export async function getNotableProgramsAroundDate(
  date: string,
  daysRange: number = 7
): Promise<NPOResult> {
  const result = await getTVProgramsAroundDate(date, daysRange)
  
  // Filter op programma's die waarschijnlijk interessant zijn
  // (langere uitzendingen, bekende categorieën)
  const notablePrograms = result.programs.filter(p => {
    // Langere programma's zijn vaak belangrijker
    if (p.duration && p.duration > 1800) return true // > 30 min
    // Bepaalde categorieën zijn interessanter
    const interestingCategories = ['serie', 'film', 'documentaire', 'show', 'entertainment']
    if (p.categories.some(c => interestingCategories.includes(c.toLowerCase()))) return true
    return false
  })

  return {
    ...result,
    programs: notablePrograms,
    totalResults: notablePrograms.length
  }
}

/**
 * Formatteert programma info voor weergave
 */
export function formatTVProgram(program: TVProgram): string {
  let result = program.title
  if (program.channel) {
    result += ` (${program.channel})`
  }
  if (program.broadcastDate) {
    const date = new Date(program.broadcastDate)
    result += ` - ${date.toLocaleDateString('nl-NL')}`
  }
  return result
}