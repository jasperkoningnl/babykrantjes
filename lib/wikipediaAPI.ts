// Wikipedia scraper voor "Geboren op deze dag" (NL Wikipedia pagina's)

export interface BornPerson {
  name: string
  year: number
  description: string
  wikipediaUrl?: string
}

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
]

/**
 * Haal personen op die geboren zijn op een specifieke datum
 * Scrapet de Nederlandse Wikipedia pagina
 */
export async function getBornOnThisDay(date: string): Promise<BornPerson[]> {
  try {
    const dateObj = new Date(date)
    const day = dateObj.getDate()
    const month = MONTH_NAMES[dateObj.getMonth()]
    
    // NL Wikipedia pagina URL (bijv. "28_maart")
    const pageUrl = `${day}_${month}`
    
    // Gebruik Wikipedia API om de pagina HTML op te halen
    const apiUrl = `https://nl.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageUrl)}&prop=text&format=json&origin=*`
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.parse || !data.parse.text) {
      throw new Error('No Wikipedia data found')
    }
    
    const html = data.parse.text['*']
    
    // Parse de "Geboren" sectie
    return parseGeborenSection(html, pageUrl)
    
  } catch (error) {
    console.error('Error fetching births from Wikipedia:', error)
    return []
  }
}

function parseGeborenSection(html: string, pageUrl: string): BornPerson[] {
  const persons: BornPerson[] = []
  
  // Zoek de "Geboren" heading
  const geborenMatch = html.match(/<span class="mw-headline"[^>]*>Geboren<\/span>([\s\S]*?)(?=<span class="mw-headline"|$)/i)
  
  if (!geborenMatch) {
    console.warn('Geen "Geboren" sectie gevonden')
    return []
  }
  
  const geborenSection = geborenMatch[1]
  
  // Parse alle list items in deze sectie
  const listItemRegex = /<li>(.*?)<\/li>/g
  let match
  
  while ((match = listItemRegex.exec(geborenSection)) !== null) {
    const item = match[1]
    
    // Parse het jaar en de naam/beschrijving
    // Format: "1986 - <a href...>Lady Gaga</a>, Amerikaanse zangeres"
    const yearMatch = item.match(/(\d{4})\s*[-–]\s*/)
    if (!yearMatch) continue
    
    const year = parseInt(yearMatch[1])
    if (year < 1800 || year > 2010) continue // Filter te oude/jonge personen
    
    // Extract naam (eerste link na het jaar)
    const nameMatch = item.match(/<a[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>/)
    if (!nameMatch) continue
    
    const name = nameMatch[2]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
    
    // Extract beschrijving (tekst na de naam)
    let description = item
      .replace(/<[^>]+>/g, '') // Strip HTML
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\d{4}\s*[-–]\s*/, '') // Verwijder jaar
      .replace(name, '') // Verwijder naam
      .replace(/^[,\s]+/, '') // Verwijder leading comma/spaces
      .trim()
    
    // Als beschrijving te lang is, neem eerste deel
    if (description.length > 100) {
      description = description.substring(0, 100) + '...'
    }
    
    const wikipediaUrl = `https://nl.wikipedia.org/wiki/${encodeURIComponent(nameMatch[1].replace(/ /g, '_'))}`
    
    persons.push({
      name,
      year,
      description: description || 'Bekende persoon',
      wikipediaUrl
    })
  }
  
  // Sorteer: mix van bekende tijdperken
  persons.sort((a, b) => {
    // Prioriteit voor "golden age" (1920-2000)
    const aGolden = a.year >= 1920 && a.year <= 2000
    const bGolden = b.year >= 1920 && b.year <= 2000
    
    if (aGolden && !bGolden) return -1
    if (!aGolden && bGolden) return 1
    
    // Binnen groepen: afwisseling oud/nieuw
    return Math.abs(1960 - a.year) - Math.abs(1960 - b.year)
  })
  
  return persons.slice(0, 20) // Max 20 personen
}

/**
 * Formateer lijst van personen voor display
 */
export function formatBornPersons(persons: BornPerson[]): string {
  if (persons.length === 0) {
    return 'Geen bekende personen gevonden voor deze datum.'
  }
  
  return persons
    .slice(0, 8)
    .map(person => `${person.name} (${person.year}) - ${person.description}`)
    .join('\n')
}