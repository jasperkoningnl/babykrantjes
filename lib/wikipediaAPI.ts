// Wikipedia scraper voor "Geboren op deze dag" (NL Wikipedia)

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
 */
export async function getBornOnThisDay(date: string): Promise<BornPerson[]> {
  try {
    const dateObj = new Date(date)
    const day = dateObj.getDate()
    const monthIndex = dateObj.getMonth()
    const month = MONTH_NAMES[monthIndex]
    
    console.log(`Fetching births for ${day} ${month}`)
    
    // Probeer eerst de Wikipedia Parse API
    const pageTitle = `${day}_${month}`
    const apiUrl = `https://nl.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&section=2&format=json&origin=*`
    
    console.log('API URL:', apiUrl)
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'BabykrantjesGenerator/1.0',
      }
    })
    
    if (!response.ok) {
      console.error('Wikipedia API response not OK:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('Wikipedia API response:', data)
    
    if (data.error) {
      console.error('Wikipedia API error:', data.error)
      return []
    }
    
    if (!data.parse || !data.parse.text || !data.parse.text['*']) {
      console.error('No parse text in response')
      return []
    }
    
    const html = data.parse.text['*']
    console.log('HTML length:', html.length)
    
    return parseGeborenSection(html, pageTitle)
    
  } catch (error) {
    console.error('Error fetching births from Wikipedia:', error)
    return []
  }
}

function parseGeborenSection(html: string, pageUrl: string): BornPerson[] {
  const persons: BornPerson[] = []
  
  console.log('Parsing HTML for births...')
  
  // Zoek list items in de HTML (geboren sectie is meestal de eerste ul)
  const listItemRegex = /<li>([\s\S]*?)<\/li>/g
  let match
  let itemCount = 0
  
  while ((match = listItemRegex.exec(html)) !== null) {
    itemCount++
    const item = match[1]
    
    // Parse het jaar - kan met of zonder link zijn
    // Format 1: "1986 - Name" 
    // Format 2: "<a href...>1986</a> - Name"
    let yearMatch = item.match(/^(\d{4})\s*[-–—]\s*/)
    if (!yearMatch) {
      // Probeer met link
      yearMatch = item.match(/^<a[^>]*>(\d{4})<\/a>\s*[-–—]\s*/)
    }
    
    if (!yearMatch) continue
    
    const year = parseInt(yearMatch[1])
    if (year < 1800 || year > 2015) continue
    
    // Extract naam uit de eerste link
    const linkMatch = item.match(/<a\s+href="[^"]*"\s+title="([^"]*)">([^<]+)<\/a>/)
    if (!linkMatch) continue
    
    const title = linkMatch[1]
    const name = linkMatch[2]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    
    // Extract beschrijving (alles na jaar en naam, voor eventuele referenties)
    let description = item
      .replace(/<sup[^>]*>.*?<\/sup>/g, '') // Verwijder referenties
      .replace(/<[^>]+>/g, '') // Strip HTML
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/\d{4}\s*[-–—]\s*/, '') // Verwijder jaar
      .replace(name, '') // Verwijder naam
      .replace(/^[,\s]+/, '') // Trim
      .replace(/\([†\d\s-]+\)/, '') // Verwijder doodjaar info
      .trim()
    
    // Eerste zin pakken als beschrijving te lang is
    if (description.length > 80) {
      const firstSentence = description.split(/[.;]|,\s(?=[A-Z])/)[0]
      description = firstSentence.trim()
    }
    
    if (!description || description.length < 3) {
      description = 'Bekende persoon'
    }
    
    const wikipediaUrl = `https://nl.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    
    persons.push({
      name,
      year,
      description,
      wikipediaUrl
    })
    
    console.log(`Found: ${name} (${year}) - ${description}`)
  }
  
  console.log(`Total items parsed: ${itemCount}, persons found: ${persons.length}`)
  
  // Handmatige prioriteit voor zeer bekende personen
  const famousKeywords = [
    'nobelprijswinnaar', 'oscar', 'acteur', 'actrice', 'zanger', 'zangeres',
    'schrijver', 'koning', 'koningin', 'president', 'premier', 'wiskundige'
  ]
  
  // Sorteer op bekendheid
  persons.sort((a, b) => {
    // Check of beschrijving bekende keywords bevat
    const aFamous = famousKeywords.some(kw => 
      a.description.toLowerCase().includes(kw)
    )
    const bFamous = famousKeywords.some(kw => 
      b.description.toLowerCase().includes(kw)
    )
    
    if (aFamous && !bFamous) return -1
    if (!aFamous && bFamous) return 1
    
    // Als beide famous of beide niet: sorteer op golden age (1940-1990)
    const aGolden = a.year >= 1940 && a.year <= 1990
    const bGolden = b.year >= 1940 && b.year <= 1990
    
    if (aGolden && !bGolden) return -1
    if (!aGolden && bGolden) return 1
    
    // Binnen dezelfde categorie: meer naar midden van periode
    return Math.abs(1965 - a.year) - Math.abs(1965 - b.year)
  })
  
  return persons.slice(0, 15)
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