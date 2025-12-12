// lib/newsAPI.ts
// @version 1.2.0
// Client-side wrapper voor de nieuws API endpoints
// UPDATE v1.1.0: Ondersteuning voor NewsItem met dag-informatie
// UPDATE v1.2.0: Ondersteuning voor Dutch headlines (Volkskrant)

// ============================================================================
// Types
// ============================================================================

export interface NewsEvent {
  category: string
  text: string
}

export interface NewsItem {
  day: number
  text: string
}

export interface DutchHeadline {
  title: string
  url: string
  category: string | null
}

export interface DailyNewsResult {
  date: string
  events: NewsEvent[]
  totalEvents: number
  source: string
  sourceUrl: string
  apiVersion: string
  debug?: {
    categoriesFound: string[]
    rawCategoryCount: number
  }
  error?: string
}

export interface MonthNewsResult {
  year: number
  month: number
  monthName: string
  items: NewsItem[]
  totalItems: number
  source: string
  sourceUrl: string
  apiVersion: string
  debug?: {
    datesFound: string[]
    rawItemCount: number
  }
  error?: string
}

export interface DutchNewsResult {
  date: string
  headlines: DutchHeadline[]
  totalHeadlines: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
}

export interface AllNewsResult {
  daily: DailyNewsResult | null
  monthly: MonthNewsResult | null
  dutch: DutchNewsResult | null
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Haalt internationaal nieuws op voor een specifieke dag
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getDailyNews(date: string): Promise<DailyNewsResult> {
  try {
    const response = await fetch(`/api/news/daily?date=${encodeURIComponent(date)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data: DailyNewsResult = await response.json()
    return data
  } catch (error) {
    console.error('[newsAPI] getDailyNews error:', error)
    return {
      date,
      events: [],
      totalEvents: 0,
      source: 'Wikipedia Portal:Current_events',
      sourceUrl: '',
      apiVersion: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Haalt Nederlands maandoverzicht nieuws op
 * @param date - Datum in YYYY-MM-DD formaat (dag wordt genegeerd, alleen jaar+maand gebruikt)
 */
export async function getMonthlyNews(date: string): Promise<MonthNewsResult> {
  try {
    const response = await fetch(`/api/news/monthly?date=${encodeURIComponent(date)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data: MonthNewsResult = await response.json()
    return data
  } catch (error) {
    console.error('[newsAPI] getMonthlyNews error:', error)
    const [yearStr, monthStr] = date.split('-')
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                        'juli', 'augustus', 'september', 'oktober', 'november', 'december']
    const month = parseInt(monthStr, 10)
    
    return {
      year: parseInt(yearStr, 10),
      month,
      monthName: monthNames[month - 1] || '',
      items: [],
      totalItems: 0,
      source: 'Wikipedia NL Maandoverzicht',
      sourceUrl: '',
      apiVersion: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Haalt Nederlandse nieuwsheadlines op van de Volkskrant
 * @param date - Datum in YYYY-MM-DD formaat
 * @note Archief beschikbaar vanaf 18 augustus 2017
 */
export async function getDutchNews(date: string): Promise<DutchNewsResult> {
  try {
    const response = await fetch(`/api/news/dutch?date=${encodeURIComponent(date)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data: DutchNewsResult = await response.json()
    return data
  } catch (error) {
    console.error('[newsAPI] getDutchNews error:', error)
    return {
      date,
      headlines: [],
      totalHeadlines: 0,
      source: 'de Volkskrant',
      sourceUrl: '',
      apiVersion: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Haalt dagelijks, maandelijks én Nederlands nieuws op in parallel
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getAllNews(date: string): Promise<AllNewsResult> {
  try {
    const [daily, monthly, dutch] = await Promise.all([
      getDailyNews(date),
      getMonthlyNews(date),
      getDutchNews(date)
    ])
    
    return { daily, monthly, dutch }
  } catch (error) {
    console.error('[newsAPI] getAllNews error:', error)
    return { daily: null, monthly: null, dutch: null }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Groepeert nieuws events per categorie
 */
export function groupNewsByCategory(events: NewsEvent[]): Map<string, NewsEvent[]> {
  const grouped = new Map<string, NewsEvent[]>()
  
  for (const event of events) {
    const existing = grouped.get(event.category) || []
    existing.push(event)
    grouped.set(event.category, existing)
  }
  
  return grouped
}

/**
 * Groepeert Dutch headlines per categorie
 */
export function groupHeadlinesByCategory(headlines: DutchHeadline[]): Map<string, DutchHeadline[]> {
  const grouped = new Map<string, DutchHeadline[]>()
  
  for (const headline of headlines) {
    const category = headline.category || 'Overig'
    const existing = grouped.get(category) || []
    existing.push(headline)
    grouped.set(category, existing)
  }
  
  return grouped
}

/**
 * Groepeert maandelijks nieuws per dag
 */
export function groupNewsByDay(items: NewsItem[]): Map<number, NewsItem[]> {
  const grouped = new Map<number, NewsItem[]>()
  
  for (const item of items) {
    const existing = grouped.get(item.day) || []
    existing.push(item)
    grouped.set(item.day, existing)
  }
  
  return grouped
}

/**
 * Formatteert een nieuws event voor display
 */
export function formatNewsEvent(event: NewsEvent): string {
  return `[${event.category}] ${event.text}`
}

/**
 * Formatteert een nieuws item met dag voor display
 */
export function formatNewsItem(item: NewsItem, monthName: string): string {
  return `${item.day} ${monthName}: ${item.text}`
}

/**
 * Trunceert tekst tot een maximum lengte
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Filtert nieuws items voor een specifieke dag
 */
export function filterItemsByDay(items: NewsItem[], day: number): NewsItem[] {
  return items.filter(item => item.day === day)
}

/**
 * Haalt unieke categorieën uit nieuws events
 */
export function getUniqueCategories(events: NewsEvent[]): string[] {
  return Array.from(new Set(events.map(e => e.category)))
}

/**
 * Haalt unieke dagen uit nieuws items
 */
export function getUniqueDays(items: NewsItem[]): number[] {
  return Array.from(new Set(items.map(i => i.day))).sort((a, b) => a - b)
}