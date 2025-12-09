// lib/newsAPI.ts
// @version 1.0.0
// Client voor nieuws API's
// Bronnen: Wikipedia Current Events (EN) en Wikipedia Maandoverzicht (NL)

export interface NewsEvent {
  category: string
  text: string
}

export interface DailyNewsResult {
  date: string
  events: NewsEvent[]
  totalEvents: number
  source: string
  sourceUrl: string
  apiVersion?: string
  error?: string
}

export interface MonthNewsResult {
  year: number
  month: number
  monthName: string
  items: string[]
  totalItems: number
  source: string
  sourceUrl: string
  apiVersion?: string
  error?: string
}

/**
 * Haalt internationaal nieuws op voor een specifieke datum
 * Bron: Wikipedia Portal:Current_events (Engels)
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getDailyNews(date: string): Promise<DailyNewsResult> {
  const emptyResult: DailyNewsResult = {
    date,
    events: [],
    totalEvents: 0,
    source: 'Wikipedia Portal:Current_events',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/news/daily?date=${date}`)
    
    if (!response.ok) {
      console.error(`[NewsAPI] Daily news error: ${response.status}`)
      return emptyResult
    }

    return await response.json()

  } catch (error) {
    console.error('[NewsAPI] Error fetching daily news:', error)
    return emptyResult
  }
}

/**
 * Haalt het maandoverzicht op (Nederlands nieuws en context)
 * Bron: Wikipedia NL maandpagina
 * @param date - Datum in YYYY-MM-DD of YYYY-MM formaat
 */
export async function getMonthlyNews(date: string): Promise<MonthNewsResult> {
  const emptyResult: MonthNewsResult = {
    year: 0,
    month: 0,
    monthName: '',
    items: [],
    totalItems: 0,
    source: 'Wikipedia NL Maandoverzicht',
    sourceUrl: ''
  }

  try {
    const response = await fetch(`/api/news/monthly?date=${date}`)
    
    if (!response.ok) {
      console.error(`[NewsAPI] Monthly news error: ${response.status}`)
      return emptyResult
    }

    return await response.json()

  } catch (error) {
    console.error('[NewsAPI] Error fetching monthly news:', error)
    return emptyResult
  }
}

/**
 * Haalt zowel dagelijks als maandelijks nieuws op
 * Handig voor het in één keer ophalen van alle nieuws context
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getAllNews(date: string): Promise<{
  daily: DailyNewsResult
  monthly: MonthNewsResult
}> {
  const [daily, monthly] = await Promise.all([
    getDailyNews(date),
    getMonthlyNews(date)
  ])

  return { daily, monthly }
}

/**
 * Formatteert een nieuws event voor weergave
 */
export function formatNewsEvent(event: NewsEvent): string {
  return `${event.category}: ${event.text}`
}

/**
 * Groepeert nieuws events per categorie
 */
export function groupNewsByCategory(events: NewsEvent[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  
  for (const event of events) {
    if (!grouped[event.category]) {
      grouped[event.category] = []
    }
    grouped[event.category].push(event.text)
  }
  
  return grouped
}