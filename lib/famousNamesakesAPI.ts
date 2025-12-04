// lib/famousNamesakesAPI.ts
// @version 1.0.0
// API voor het ophalen van bekende naamdragers
// Bronnen: Wikipedia NL en EN

export interface FamousPerson {
  name: string
  description: string
  wikipediaUrl?: string
  source: 'nl' | 'en'
}

export interface FamousNamesakesData {
  firstName: string
  persons: FamousPerson[]
  sources: {
    nl: string | null
    en: string | null
  }
}

/**
 * Extraheert de eerste voornaam uit een volledige naam
 */
function extractFirstName(fullName: string): string {
  if (!fullName || fullName.trim() === '') return ''
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 0 ? parts[0] : ''
}

/**
 * Hoofdfunctie: haalt bekende naamdragers op
 * Doorzoekt parallel NL en EN Wikipedia
 */
export async function getFamousNamesakes(fullName: string): Promise<FamousNamesakesData> {
  const firstName = extractFirstName(fullName)
  
  if (!firstName) {
    return {
      firstName: '',
      persons: [],
      sources: { nl: null, en: null }
    }
  }

  console.log(`[FamousNamesakes] Looking up: "${firstName}"`)

  // Parallel beide talen proberen
  const [nlResult, enResult] = await Promise.all([
    fetchFromWikipedia(firstName, 'nl'),
    fetchFromWikipedia(firstName, 'en')
  ])

  // Combineer resultaten (NL eerst, dan EN)
  const allPersons: FamousPerson[] = []
  const seenNames = new Set<string>()

  for (const person of nlResult.persons) {
    const lowerName = person.name.toLowerCase()
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName)
      allPersons.push(person)
    }
  }

  for (const person of enResult.persons) {
    const lowerName = person.name.toLowerCase()
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName)
      allPersons.push(person)
    }
  }

  console.log(`[FamousNamesakes] Found ${allPersons.length} persons total`)

  return {
    firstName,
    persons: allPersons,
    sources: {
      nl: nlResult.pageUrl,
      en: enResult.pageUrl
    }
  }
}

interface WikipediaResult {
  persons: FamousPerson[]
  pageUrl: string | null
}

/**
 * Haalt bekende naamdragers op van Wikipedia (NL of EN)
 */
async function fetchFromWikipedia(
  name: string,
  lang: 'nl' | 'en'
): Promise<WikipediaResult> {
  const emptyResult: WikipediaResult = { persons: [], pageUrl: null }

  try {
    // Probeer verschillende paginatitels
    const suffixes = lang === 'nl'
      ? ['_(voornaam)', '']
      : ['_(given_name)', '_(name)', '']

    for (const suffix of suffixes) {
      const pageTitle = `${name}${suffix}`
      console.log(`[FamousNamesakes][${lang}] Trying: ${pageTitle}`)

      const result = await tryFetchPage(pageTitle, lang, name)
      
      if (result && result.persons.length > 0) {
        return result
      }
      
      // Check op doorverwijspagina
      if (result && result.pageUrl === 'disambiguation') {
        const disambigResult = await handleDisambiguation(name, lang)
        if (disambigResult && disambigResult.persons.length > 0) {
          return disambigResult
        }
      }
    }

    return emptyResult
  } catch (error) {
    console.error(`[FamousNamesakes][${lang}] Error:`, error)
    return emptyResult
  }
}

/**
 * Probeert een Wikipedia pagina op te halen
 */
async function tryFetchPage(
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

    if (!response.ok) return null

    const data = await response.json()
    if (data.error) return null
    if (!data.parse?.text?.['*']) return null

    const html = data.parse.text['*']
    const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`

    // Check doorverwijspagina
    if (isDisambiguationPage(html, lang)) {
      return { persons: [], pageUrl: 'disambiguation' }
    }

    const persons = parseFamousPersons(html, lang, originalName)
    
    return {
      persons,
      pageUrl: persons.length > 0 ? pageUrl : null
    }
  } catch (error) {
    console.error(`[FamousNamesakes][${lang}] Fetch error for ${pageTitle}:`, error)
    return null
  }
}

/**
 * Detecteert doorverwijspagina's
 */
function isDisambiguationPage(html: string, lang: 'nl' | 'en'): boolean {
  const markers = lang === 'nl'
    ? ['doorverwijspagina', 'Dit is een doorverwijspagina']
    : ['disambiguation', 'This disambiguation page', 'may refer to']

  const lowerHtml = html.toLowerCase()
  return markers.some(m => lowerHtml.includes(m.toLowerCase()))
}

/**
 * Handelt doorverwijspagina's af
 */
async function handleDisambiguation(
  name: string,
  lang: 'nl' | 'en'
): Promise<WikipediaResult | null> {
  const baseUrl = lang === 'nl'
    ? 'https://nl.wikipedia.org/w/api.php'
    : 'https://en.wikipedia.org/w/api.php'

  const apiUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(name)}&prop=links&format=json&origin=*`

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.parse?.links) return null

    // Zoek naar voornaam-pagina links
    const targetSuffixes = lang === 'nl'
      ? ['(voornaam)', '(naam)']
      : ['(given name)', '(given_name)', '(name)', '(first name)']

    for (const link of data.parse.links) {
      const title = link['*'] || ''
      const lowerTitle = title.toLowerCase()

      if (targetSuffixes.some(s => lowerTitle.includes(s.toLowerCase()))) {
        console.log(`[FamousNamesakes][${lang}] Found via disambiguation: ${title}`)
        return await tryFetchPage(title, lang, name)
      }
    }

    return null
  } catch (error) {
    console.error(`[FamousNamesakes][${lang}] Disambiguation error:`, error)
    return null
  }
}

/**
 * Parset bekende naamdragers uit Wikipedia HTML
 */
function parseFamousPersons(
  html: string,
  lang: 'nl' | 'en',
  originalName: string
): FamousPerson[] {
  const persons: FamousPerson[] = []

  try {
    // Zoek de naamdragers-sectie
    const sectionHeaders = lang === 'nl'
      ? ['Bekende naamdragers', 'Bekende personen', 'Naamdragers', 'Bekende mensen']
      : ['Notable people', 'People with the given name', 'People named', 'Famous people', 'Notable persons']

    let sectionHtml = ''

    for (const header of sectionHeaders) {
      const patterns = [
        new RegExp(`<h[23][^>]*>\\s*(?:<[^>]+>)*\\s*${escapeRegex(header)}\\s*(?:<[^>]+>)*\\s*</h[23]>([\\s\\S]*?)(?=<h[23]|$)`, 'i'),
        new RegExp(`id="[^"]*${escapeRegex(header.replace(/ /g, '_'))}[^"]*"[^>]*>([\\s\\S]*?)(?=<h[23]|$)`, 'i')
      ]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
          sectionHtml = match[1] || match[0]
          break
        }
      }
      if (sectionHtml) break
    }

    if (!sectionHtml) {
      sectionHtml = html // Fallback: scan hele pagina
    }

    // Non-person filter
    const nonPersonIndicators = lang === 'nl'
      ? ['county', 'plaats', 'stad', 'dorp', 'gemeente', 'park', 'rivier', 'berg', 'eiland',
         'gebied', 'streek', 'provincie', 'staat', 'district', 'regio', 'gebergte', 'meer']
      : ['county', 'place', 'city', 'town', 'village', 'municipality', 'park', 'river',
         'mountain', 'island', 'area', 'region', 'province', 'state', 'district', 'township',
         'census-designated', 'unincorporated', 'community', 'borough']

    // Parse list items
    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    while ((match = listItemRegex.exec(sectionHtml)) !== null) {
      const item = match[1]

      const linkMatch = item.match(/<a\s+href="([^"]*)"[^>]*(?:\s+title="([^"]*)")?[^>]*>([^<]+)<\/a>/)
      if (!linkMatch) continue

      const href = linkMatch[1]
      const title = linkMatch[2] || linkMatch[3]
      const linkText = linkMatch[3]

      // Filters
      if (href.includes(':') && !href.includes('/wiki/')) continue
      if (/^\d{4}$/.test(linkText)) continue
      if (linkText.length < 3) continue

      // Beschrijving
      let description = item
        .replace(/<sup[^>]*>.*?<\/sup>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      description = description.replace(linkText, '').replace(/^[\s,\-–—:]+/, '').trim()

      // Filter non-persons
      const lowerDesc = description.toLowerCase()
      const lowerTitle = title.toLowerCase()
      const lowerLinkText = linkText.toLowerCase()

      const isNonPerson = nonPersonIndicators.some(ind =>
        lowerDesc.includes(ind) ||
        lowerTitle.includes(ind) ||
        lowerLinkText.includes(ind)
      )

      if (isNonPerson) {
        console.log(`[FamousNamesakes][${lang}] Filtered: ${linkText}`)
        continue
      }

      // Trim beschrijving
      if (description.length > 150) {
        description = description.substring(0, 150).trim() + '...'
      }
      if (description.length < 3) {
        description = ''
      }

      const baseWikiUrl = lang === 'nl'
        ? 'https://nl.wikipedia.org'
        : 'https://en.wikipedia.org'

      const wikipediaUrl = href.startsWith('/wiki/')
        ? `${baseWikiUrl}${href}`
        : href.startsWith('http')
          ? href
          : `${baseWikiUrl}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

      // Duplicaat check
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

    console.log(`[FamousNamesakes][${lang}] Found ${persons.length} persons`)
  } catch (error) {
    console.error(`[FamousNamesakes][${lang}] Parse error:`, error)
  }

  return persons
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}