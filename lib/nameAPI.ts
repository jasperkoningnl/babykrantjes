// Wikipedia API voor naambetekenis en bekende naamdragers
// Parallelle lookup in NL en EN Wikipedia met fallback logica

export interface FamousPerson {
  name: string
  description: string
  wikipediaUrl?: string
  source: 'nl' | 'en'
}

export interface NameData {
  firstName: string
  meaning: string | null
  origin: string | null
  famousPersons: FamousPerson[]
  sources: {
    nl: string | null
    en: string | null
  }
}

interface WikipediaResult {
  meaning: string | null
  origin: string | null
  famousPersons: FamousPerson[]
  pageUrl: string | null
}

/**
 * Extraheert de eerste voornaam uit een volledige naam
 * Behandelt streepjesnamen (Jan-Peter) als één naam
 */
export function extractFirstName(fullName: string): string {
  if (!fullName || fullName.trim() === '') return ''
  
  const trimmed = fullName.trim()
  
  // Split op spaties, maar behoud streepjesnamen
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 0) return ''
  
  // Eerste deel is de voornaam (inclusief eventueel streepje)
  return parts[0]
}

/**
 * Hoofdfunctie: haalt naambetekenis en bekende personen op
 * Probeert parallel NL en EN Wikipedia
 */
export async function getNameMeaning(fullName: string): Promise<NameData> {
  const firstName = extractFirstName(fullName)
  
  if (!firstName) {
    return {
      firstName: '',
      meaning: null,
      origin: null,
      famousPersons: [],
      sources: { nl: null, en: null }
    }
  }

  console.log(`Looking up name: "${firstName}"`)

  // Parallel beide talen proberen
  const [nlResult, enResult] = await Promise.all([
    fetchNameFromWikipedia(firstName, 'nl'),
    fetchNameFromWikipedia(firstName, 'en')
  ])

  console.log('NL result:', nlResult)
  console.log('EN result:', enResult)

  // Resultaten combineren
  return mergeResults(firstName, nlResult, enResult)
}

/**
 * Probeert een naam op te zoeken in Wikipedia (NL of EN)
 * Met fallback logica voor verschillende paginastructuren
 */
async function fetchNameFromWikipedia(
  name: string, 
  lang: 'nl' | 'en'
): Promise<WikipediaResult> {
  const emptyResult: WikipediaResult = {
    meaning: null,
    origin: null,
    famousPersons: [],
    pageUrl: null
  }

  try {
    // Stap 1: Probeer directe voornaam-pagina
    const suffixes = lang === 'nl' 
      ? ['_(voornaam)', ''] 
      : ['_(given_name)', '_(name)', '']
    
    for (const suffix of suffixes) {
      const pageTitle = `${name}${suffix}`
      console.log(`[${lang}] Trying: ${pageTitle}`)
      
      const result = await tryFetchWikipediaPage(pageTitle, lang, name)
      
      if (result && (result.meaning || result.famousPersons.length > 0)) {
        return result
      }
      
      // Check of het een doorverwijspagina is
      if (result && result.pageUrl === 'disambiguation') {
        console.log(`[${lang}] Disambiguation page found, searching for given name link...`)
        const disambigResult = await handleDisambiguationPage(name, lang)
        if (disambigResult) {
          return disambigResult
        }
      }
    }

    return emptyResult
  } catch (error) {
    console.error(`[${lang}] Error fetching name data:`, error)
    return emptyResult
  }
}

/**
 * Probeert een specifieke Wikipedia pagina op te halen en te parsen
 */
async function tryFetchWikipediaPage(
  pageTitle: string,
  lang: 'nl' | 'en',
  originalName: string
): Promise<WikipediaResult | null> {
  const baseUrl = lang === 'nl' 
    ? 'https://nl.wikipedia.org/w/api.php'
    : 'https://en.wikipedia.org/w/api.php'

  const apiUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) {
      console.log(`[${lang}] HTTP error for ${pageTitle}: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.error) {
      console.log(`[${lang}] API error for ${pageTitle}:`, data.error.code)
      return null
    }

    if (!data.parse?.text?.['*']) {
      return null
    }

    const html = data.parse.text['*']
    const fullPageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`

    // Check of het een doorverwijspagina is
    if (isDisambiguationPage(html, lang)) {
      return {
        meaning: null,
        origin: null,
        famousPersons: [],
        pageUrl: 'disambiguation'
      }
    }

    // Parse de pagina
    const meaning = parseNameMeaning(html, lang)
    const origin = parseNameOrigin(html, lang)
    const famousPersons = parseFamousPersons(html, lang, originalName)

    return {
      meaning,
      origin,
      famousPersons,
      pageUrl: fullPageUrl
    }
  } catch (error) {
    console.error(`[${lang}] Fetch error for ${pageTitle}:`, error)
    return null
  }
}

/**
 * Detecteert of een pagina een doorverwijspagina is
 */
function isDisambiguationPage(html: string, lang: 'nl' | 'en'): boolean {
  const markers = lang === 'nl'
    ? ['doorverwijspagina', 'Dit is een doorverwijspagina']
    : ['disambiguation', 'This disambiguation page', 'may refer to']
  
  const lowerHtml = html.toLowerCase()
  return markers.some(marker => lowerHtml.includes(marker.toLowerCase()))
}

/**
 * Handelt een doorverwijspagina af door te zoeken naar voornaam-link
 */
async function handleDisambiguationPage(
  name: string,
  lang: 'nl' | 'en'
): Promise<WikipediaResult | null> {
  const baseUrl = lang === 'nl'
    ? 'https://nl.wikipedia.org/w/api.php'
    : 'https://en.wikipedia.org/w/api.php'

  // Haal de doorverwijspagina opnieuw op om links te scannen
  const apiUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(name)}&prop=links&format=json&origin=*`

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) return null

    const data = await response.json()
    
    if (!data.parse?.links) return null

    // Zoek naar link met (voornaam), (given_name), of (name)
    const targetSuffixes = lang === 'nl'
      ? ['(voornaam)', '(naam)']
      : ['(given name)', '(given_name)', '(name)', '(first name)']

    for (const link of data.parse.links) {
      const title = link['*'] || ''
      const lowerTitle = title.toLowerCase()
      
      if (targetSuffixes.some(suffix => lowerTitle.includes(suffix.toLowerCase()))) {
        console.log(`[${lang}] Found name page link: ${title}`)
        return await tryFetchWikipediaPage(title, lang, name)
      }
    }

    return null
  } catch (error) {
    console.error(`[${lang}] Error handling disambiguation:`, error)
    return null
  }
}

/**
 * Parse naambetekenis uit de HTML
 */
function parseNameMeaning(html: string, lang: 'nl' | 'en'): string | null {
  try {
    // Verwijder HTML tags voor makkelijker parsen, maar behoud structuur
    // Zoek in de eerste paar paragrafen naar betekenis-informatie
    
    // Zoek de eerste <p> tag met substantiële inhoud
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let match
    let meaningText = ''
    let paragraphCount = 0
    
    while ((match = paragraphRegex.exec(html)) !== null && paragraphCount < 3) {
      const content = match[1]
        .replace(/<sup[^>]*>.*?<\/sup>/g, '') // Verwijder referenties
        .replace(/<[^>]+>/g, '') // Strip HTML
        .replace(/\s+/g, ' ')
        .trim()
      
      // Skip lege of te korte paragrafen
      if (content.length < 20) continue
      
      // Skip als het alleen een afbeeldingsbeschrijving is
      if (content.startsWith('thumb|') || content.includes('miniatur|')) continue
      
      paragraphCount++
      meaningText += content + ' '
    }

    meaningText = meaningText.trim()
    
    if (!meaningText) return null

    // Zoek naar typische betekenis-indicatoren
    const meaningIndicators = lang === 'nl'
      ? ['betekent', 'betekenis', 'afgeleid van', 'komt van', 'afkomstig', 'Hebreeuwse', 'Griekse', 'Latijnse', 'Germaanse']
      : ['means', 'meaning', 'derived from', 'comes from', 'origin', 'Hebrew', 'Greek', 'Latin', 'Germanic']

    // Check of de tekst betekenis-informatie bevat
    const hasMeaningInfo = meaningIndicators.some(indicator => 
      meaningText.toLowerCase().includes(indicator.toLowerCase())
    )

    if (hasMeaningInfo || meaningText.length > 50) {
      // Beperk tot eerste ~500 karakters voor overzichtelijkheid
      if (meaningText.length > 500) {
        // Probeer op een zin-grens af te kappen
        const truncated = meaningText.substring(0, 500)
        const lastSentence = truncated.lastIndexOf('. ')
        if (lastSentence > 200) {
          return truncated.substring(0, lastSentence + 1)
        }
        return truncated + '...'
      }
      return meaningText
    }

    return null
  } catch (error) {
    console.error('Error parsing meaning:', error)
    return null
  }
}

/**
 * Parse naam-oorsprong uit de HTML
 */
function parseNameOrigin(html: string, lang: 'nl' | 'en'): string | null {
  // Voor nu extracten we oorsprong uit de betekenis-tekst
  // Dit kan later verfijnd worden met specifieke parsing
  
  const originPatterns = lang === 'nl'
    ? [
        /(?:is\s+)?(?:een\s+)?(\w+(?:se|sche))\s+(?:voor)?naam/i,
        /(?:van|uit\s+het)\s+(\w+)/i,
        /afgeleid\s+van\s+(?:het\s+)?(\w+)/i
      ]
    : [
        /(?:is\s+)?(?:a\s+)?(\w+)\s+(?:given\s+)?name/i,
        /(?:of|from)\s+(\w+)\s+origin/i,
        /derived\s+from\s+(?:the\s+)?(\w+)/i
      ]

  const text = html.replace(/<[^>]+>/g, ' ')

  for (const pattern of originPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const origin = match[1].trim()
      // Filter onzinnige matches
      if (origin.length > 2 && origin.length < 30) {
        return origin
      }
    }
  }

  return null
}

/**
 * Parse bekende naamdragers uit de HTML
 */
function parseFamousPersons(
  html: string, 
  lang: 'nl' | 'en',
  originalName: string
): FamousPerson[] {
  const persons: FamousPerson[] = []
  
  try {
    // Zoek de sectie met bekende naamdragers
    const sectionHeaders = lang === 'nl'
      ? ['Bekende naamdragers', 'Bekende personen', 'Naamdragers', 'Bekende mensen']
      : ['Notable people', 'People with the given name', 'People named', 'Famous people', 'Notable persons', 'People with this name']

    let sectionHtml = ''
    
    // Zoek naar sectie headers
    for (const header of sectionHeaders) {
      // Probeer verschillende header formaten
      const headerPatterns = [
        new RegExp(`<h[23][^>]*>\\s*(?:<[^>]+>)*\\s*${escapeRegex(header)}\\s*(?:<[^>]+>)*\\s*</h[23]>([\\s\\S]*?)(?=<h[23]|$)`, 'i'),
        new RegExp(`id="[^"]*${escapeRegex(header.replace(/ /g, '_'))}[^"]*"[^>]*>([\\s\\S]*?)(?=<h[23]|$)`, 'i')
      ]
      
      for (const pattern of headerPatterns) {
        const match = html.match(pattern)
        if (match) {
          sectionHtml = match[1] || match[0]
          console.log(`[${lang}] Found section: ${header}`)
          break
        }
      }
      
      if (sectionHtml) break
    }

    // Als geen specifieke sectie gevonden, probeer bullet lists te vinden
    if (!sectionHtml) {
      console.log(`[${lang}] No specific section found, scanning for lists...`)
      sectionHtml = html
    }

    // Parse list items
    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    while ((match = listItemRegex.exec(sectionHtml)) !== null) {
      const item = match[1]
      
      // Zoek naar links naar personen
      const linkMatch = item.match(/<a\s+href="([^"]*)"[^>]*(?:\s+title="([^"]*)")?[^>]*>([^<]+)<\/a>/)
      
      if (!linkMatch) continue
      
      const href = linkMatch[1]
      const title = linkMatch[2] || linkMatch[3]
      const linkText = linkMatch[3]
      
      // Filter: moet een persoonsnaam lijken
      // Skip categorieën, jaren, etc.
      if (href.includes(':') && !href.includes('/wiki/')) continue
      if (/^\d{4}$/.test(linkText)) continue // Skip jaar-links
      if (linkText.length < 3) continue
      
      // Haal beschrijving uit de rest van het list item
      let description = item
        .replace(/<sup[^>]*>.*?<\/sup>/g, '') // Verwijder referenties
        .replace(/<[^>]+>/g, ' ') // Strip HTML
        .replace(/\s+/g, ' ')
        .trim()
      
      // Verwijder de naam zelf uit de beschrijving
      description = description.replace(linkText, '').replace(/^[\s,\-–—:]+/, '').trim()
      
      // Verkort beschrijving indien nodig
      if (description.length > 150) {
        const firstPart = description.substring(0, 150)
        const lastSpace = firstPart.lastIndexOf(' ')
        description = firstPart.substring(0, lastSpace) + '...'
      }
      
      if (!description || description.length < 3) {
        description = ''
      }

      // Bouw Wikipedia URL
      const baseWikiUrl = lang === 'nl' 
        ? 'https://nl.wikipedia.org'
        : 'https://en.wikipedia.org'
      
      const wikipediaUrl = href.startsWith('/wiki/') 
        ? `${baseWikiUrl}${href}`
        : href.startsWith('http') 
          ? href 
          : `${baseWikiUrl}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

      // Voeg toe als het niet dubbel is
      const isDuplicate = persons.some(p => 
        p.name.toLowerCase() === linkText.toLowerCase()
      )
      
      if (!isDuplicate) {
        persons.push({
          name: decodeHtmlEntities(linkText),
          description: decodeHtmlEntities(description),
          wikipediaUrl,
          source: lang
        })
      }
    }

    console.log(`[${lang}] Found ${persons.length} famous persons`)
  } catch (error) {
    console.error(`[${lang}] Error parsing famous persons:`, error)
  }

  return persons
}

/**
 * Combineert resultaten van NL en EN Wikipedia
 */
function mergeResults(
  firstName: string,
  nlResult: WikipediaResult,
  enResult: WikipediaResult
): NameData {
  // Betekenis: prefereer NL, fallback naar EN
  let meaning = nlResult.meaning || enResult.meaning
  let origin = nlResult.origin || enResult.origin

  // Bekende personen: combineer beide lijsten, NL eerst
  const allPersons: FamousPerson[] = []
  const seenNames = new Set<string>()

  // Voeg NL personen eerst toe
  for (const person of nlResult.famousPersons) {
    const lowerName = person.name.toLowerCase()
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName)
      allPersons.push(person)
    }
  }

  // Voeg EN personen toe die nog niet in de lijst staan
  for (const person of enResult.famousPersons) {
    const lowerName = person.name.toLowerCase()
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName)
      allPersons.push(person)
    }
  }

  return {
    firstName,
    meaning,
    origin,
    famousPersons: allPersons,
    sources: {
      nl: nlResult.pageUrl !== 'disambiguation' ? nlResult.pageUrl : null,
      en: enResult.pageUrl !== 'disambiguation' ? enResult.pageUrl : null
    }
  }
}

/**
 * Helper: escape regex speciale karakters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Helper: decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}