// lib/newsAPI.ts
// @version 1.3.0
// Client-side wrapper voor de nieuws API endpoints
// UPDATE v1.1.0: Ondersteuning voor NewsItem met dag-informatie
// UPDATE v1.2.0: Ondersteuning voor Dutch headlines (Volkskrant) - DEPRECATED
// UPDATE v1.3.0: Vervangen Volkskrant met Wayback Machine (NU.nl via Internet Archive)

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

export interface WaybackHeadline {
  title: string
  url: string
  category: string | null
  time: string | null
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

export interface WaybackNewsResult {
  date: string
  headlines: WaybackHeadline[]
  totalHeadlines: number
  source: string
  sourceUrl: string
  snapshotTimestamp: string | null
  apiVersion: string
  error?: string
}

export interface AllNewsResult {
  daily: DailyNewsResult | null
  monthly: MonthNewsResult | null
  wayback: WaybackNewsResult | null
}

// Legacy alias voor backwards compatibility
export type DutchHeadline = WaybackHeadline
export type DutchNewsResult = WaybackNewsResult

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
 * Haalt Nederlandse nieuwsheadlines op via Wayback Machine (Internet Archive)
 * @param date - Datum in YYYY-MM-DD formaat
 * @note Archief beschikbaar vanaf ~2005, beste resultaten vanaf 2010
 */
export async function getWaybackNews(date: string): Promise<WaybackNewsResult> {
  try {
    const response = await fetch(`/api/news/wayback?date=${encodeURIComponent(date)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data: WaybackNewsResult = await response.json()
    return data
  } catch (error) {
    console.error('[newsAPI] getWaybackNews error:', error)
    return {
      date,
      headlines: [],
      totalHeadlines: 0,
      source: 'NU.nl via Internet Archive',
      sourceUrl: '',
      snapshotTimestamp: null,
      apiVersion: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * @deprecated Gebruik getWaybackNews() in plaats van getDutchNews()
 * Legacy wrapper voor backwards compatibility
 */
export async function getDutchNews(date: string): Promise<WaybackNewsResult> {
  console.warn('[newsAPI] getDutchNews is deprecated, use getWaybackNews instead')
  return getWaybackNews(date)
}

/**
 * Haalt dagelijks, maandelijks én Nederlands nieuws op in parallel
 * @param date - Datum in YYYY-MM-DD formaat
 */
export async function getAllNews(date: string): Promise<AllNewsResult> {
  try {
    const [daily, monthly, wayback] = await Promise.all([
      getDailyNews(date),
      getMonthlyNews(date),
      getWaybackNews(date)
    ])
    
    return { daily, monthly, wayback }
  } catch (error) {
    console.error('[newsAPI] getAllNews error:', error)
    return { daily: null, monthly: null, wayback: null }
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
 * Groepeert Wayback headlines per categorie
 */
export function groupHeadlinesByCategory(headlines: WaybackHeadline[]): Map<string, WaybackHeadline[]> {
  const grouped = new Map<string, WaybackHeadline[]>()
  
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

/**
 * Formatteert Wayback timestamp naar leesbare datum
 * @param timestamp - Wayback timestamp format: YYYYMMDDHHMMSS
 */
export function formatWaybackTimestamp(timestamp: string): string {
  if (!timestamp || timestamp.length < 8) return ''
  
  const year = timestamp.substring(0, 4)
  const month = timestamp.substring(4, 6)
  const day = timestamp.substring(6, 8)
  const hour = timestamp.substring(8, 10) || '00'
  const minute = timestamp.substring(10, 12) || '00'
  
  return `${day}-${month}-${year} ${hour}:${minute}`
}