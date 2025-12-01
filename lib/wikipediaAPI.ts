// Wikipedia API voor "On This Day" data
// Documentatie: https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day

export interface BornPerson {
  name: string
  year: number
  description: string
  wikipediaUrl?: string
}

/**
 * Haal personen op die geboren zijn op een specifieke datum
 */
export async function getBornOnThisDay(date: string): Promise<BornPerson[]> {
  try {
    const dateObj = new Date(date)
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    
    // Probeer eerst Nederlandse Wikipedia
    const nlUrl = `https://nl.wikipedia.org/api/rest_v1/feed/onthisday/births/${month}/${day}`
    
    try {
      const nlResponse = await fetch(nlUrl, {
        headers: {
          'User-Agent': 'BabykrantjesGenerator/1.0',
        }
      })
      
      if (nlResponse.ok) {
        const nlData = await nlResponse.json()
        const nlPersons = parseWikipediaResponse(nlData, 'nl')
        
        // Als we genoeg Nederlandse resultaten hebben, gebruik die
        if (nlPersons.length >= 5) {
          return nlPersons.slice(0, 10)
        }
      }
    } catch (nlError) {
      console.log('NL Wikipedia niet beschikbaar, probeer EN')
    }
    
    // Fallback naar Engelse Wikipedia (meer data)
    const enUrl = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${month}/${day}`
    
    const enResponse = await fetch(enUrl, {
      headers: {
        'User-Agent': 'BabykrantjesGenerator/1.0',
      }
    })
    
    if (!enResponse.ok) {
      throw new Error(`Wikipedia API error: ${enResponse.status}`)
    }
    
    const enData = await enResponse.json()
    return parseWikipediaResponse(enData, 'en').slice(0, 10)
    
  } catch (error) {
    console.error('Error fetching births from Wikipedia:', error)
    return []
  }
}

function parseWikipediaResponse(data: any, lang: 'nl' | 'en'): BornPerson[] {
  if (!data.births || !Array.isArray(data.births)) {
    return []
  }
  
  return data.births
    .map((birth: any) => {
      // Probeer geboortejaar te extraheren
      let year = 0
      if (birth.year) {
        year = birth.year
      } else if (birth.text) {
        // Zoek jaar in tekst (bijv. "John Doe (1990 - ...)")
        const yearMatch = birth.text.match(/\((\d{4})/)
        if (yearMatch) {
          year = parseInt(yearMatch[1])
        }
      }
      
      // Extract beschrijving
      let description = ''
      if (birth.pages && birth.pages[0]) {
        description = birth.pages[0].description || ''
        
        // Vertaal Engelse beroepen naar Nederlands (basis vertaling)
        if (lang === 'en') {
          description = translateDescription(description)
        }
      }
      
      // Wikipedia URL
      let wikipediaUrl = ''
      if (birth.pages && birth.pages[0]) {
        const title = birth.pages[0].title
        wikipediaUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
      }
      
      return {
        name: birth.text || birth.pages?.[0]?.title || 'Onbekend',
        year,
        description: description || 'Bekende persoon',
        wikipediaUrl
      }
    })
    .filter((person: BornPerson) => {
      // Filter alleen personen met jaar en naam
      return person.year > 0 && person.name && person.name !== 'Onbekend'
    })
    .sort((a: BornPerson, b: BornPerson) => b.year - a.year) // Sorteer op jaar (nieuwste eerst)
}

function translateDescription(description: string): string {
  const translations: { [key: string]: string } = {
    'American': 'Amerikaans',
    'British': 'Brits',
    'English': 'Engels',
    'Dutch': 'Nederlands',
    'German': 'Duits',
    'French': 'Frans',
    'actor': 'acteur',
    'actress': 'actrice',
    'singer': 'zanger/zangeres',
    'musician': 'muzikant',
    'politician': 'politicus',
    'writer': 'schrijver',
    'author': 'auteur',
    'director': 'regisseur',
    'painter': 'schilder',
    'scientist': 'wetenschapper',
    'composer': 'componist',
    'footballer': 'voetballer',
    'athlete': 'atleet',
    'artist': 'artiest',
    'poet': 'dichter',
    'philosopher': 'filosoof'
  }
  
  let translated = description
  Object.entries(translations).forEach(([en, nl]) => {
    const regex = new RegExp(en, 'gi')
    translated = translated.replace(regex, nl)
  })
  
  return translated
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