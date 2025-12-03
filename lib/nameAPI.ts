// Wikipedia API voor naambetekenis en bekende naamdragers
// Strikte fallback: NL eerst, dan EN, met slimme doorverwijzing

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
  success: boolean
}

const EMPTY_RESULT: WikipediaResult = {
  meaning: null,
  origin: null,
  famousPersons: [],
  pageUrl: null,
  success: false
}

/**
 * Extraheert de eerste voornaam uit een volledige naam
 * Behandelt streepjesnamen (Jan-Peter) als één naam
 */
export function extractFirstName(fullName: string): string {
  if (!fullName || fullName.trim() === '') return ''
  
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 0) return ''
  
  return parts[0]
}

/**
 * Haalt het eerste deel van een streepjesnaam op
 * "Jan-Peter" → "Jan"
 */
function getFirstPartOfHyphenatedName(name: string): string | null {
  if (!name.includes('-')) return null
  const firstPart = name.split('-')[0]
  return firstPart.length >= 2 ? firstPart : null
}

/**
 * Hoofdfunctie: haalt naambetekenis en bekende personen op
 * Strikte fallback: NL → EN → streepjesnaam fallback
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

  console.log(`[nameAPI] Looking up name: "${firstName}"`)

  // Stap 1: Probeer NL Wikipedia
  let nlResult = await fetchNameFromWikipedia(firstName, 'nl')
  
  // Stap 2: Als NL niet genoeg opleverde, probeer EN
  let enResult: WikipediaResult = EMPTY_RESULT
  if (!nlResult.success || (!nlResult.meaning && nlResult.famousPersons.length === 0)) {
    enResult = await fetchNameFromWikipedia(firstName, 'en')
  }

  // Stap 3: Als beide niets opleverden en het is een streepjesnaam, probeer eerste deel
  const hyphenatedFirstPart = getFirstPartOfHyphenatedName(firstName)
  if (hyphenatedFirstPart && !nlResult.success && !enResult.success) {
    console.log(`[nameAPI] Trying first part of hyphenated name: "${hyphenatedFirstPart}"`)
    
    nlResult = await fetchNameFromWikipedia(hyphenatedFirstPart, 'nl')
    if (!nlResult.success) {
      enResult = await fetchNameFromWikipedia(hyphenatedFirstPart, 'en')
    }
  }

  // Resultaten combineren
  return combineResults(firstName, nlResult, enResult)
}

/**
 * Probeert een naam op te zoeken in Wikipedia (NL of EN)
 * Met strikte fallback volgorde
 */
async function fetchNameFromWikipedia(
  name: string, 
  lang: 'nl' | 'en'
): Promise<WikipediaResult> {
  console.log(`[nameAPI] [${lang.toUpperCase()}] Starting lookup for "${name}"`)

  try {
    // Stap 1: Probeer directe voornaam-pagina
    const primarySuffix = lang === 'nl' ? '_(voornaam)' : '_(given_name)'
    const primaryTitle = `${name}${primarySuffix}`
    
    console.log(`[nameAPI] [${lang.toUpperCase()}] Trying: ${primaryTitle}`)
    let result = await tryFetchWikipediaPage(primaryTitle, lang, name)
    
    if (result.success) {
      console.log(`[nameAPI] [${lang.toUpperCase()}] Success with ${primaryTitle}`)
      return result
    }

    // Stap 2 (alleen EN): Probeer ook _(name) variant
    if (lang === 'en') {
      const altTitle = `${name}_(name)`
      console.log(`[nameAPI] [${lang.toUpperCase()}] Trying: ${altTitle}`)
      result = await tryFetchWikipediaPage(altTitle, lang, name)
      
      if (result.success) {
        console.log(`[nameAPI] [${lang.toUpperCase()}] Success with ${altTitle}`)
        return result
      }
    }

    // Stap 3: Probeer basis-pagina en check voor doorverwijzing
    console.log(`[nameAPI] [${lang.toUpperCase()}] Trying base page: ${name}`)
    const redirectResult = await tryFetchWithRedirectDetection(name, lang)
    
    if (redirectResult.success) {
      console.log(`[nameAPI] [${lang.toUpperCase()}] Success via redirect`)
      return redirectResult
    }

    console.log(`[nameAPI] [${lang.toUpperCase()}] No results found`)
    return EMPTY_RESULT

  } catch (error) {
    console.error(`[nameAPI] [${lang.toUpperCase()}] Error:`, error)
    return EMPTY_RESULT
  }
}

/**
 * Probeert een pagina op te halen en checkt voor doorverwijzingen naar voornaam-pagina's
 */
async function tryFetchWithRedirectDetection(
  name: string,
  lang: 'nl' | 'en'
): Promise<WikipediaResult> {
  const baseUrl = lang === 'nl'
    ? 'https://nl.wikipedia.org/w/api.php'
    : 'https://en.wikipedia.org/w/api.php'

  // Haal pagina op met links
  const apiUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(name)}&prop=text|links&format=json&origin=*`

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) return EMPTY_RESULT

    const data = await response.json()
    
    if (data.error) return EMPTY_RESULT
    if (!data.parse?.text?.['*']) return EMPTY_RESULT

    const html = data.parse.text['*']
    const links = data.parse.links || []

    // Check of het een doorverwijspagina is
    if (isDisambiguationPage(html, lang)) {
      console.log(`[nameAPI] [${lang.toUpperCase()}] Disambiguation page detected, scanning links...`)
      
      // Zoek naar voornaam-link in de links OF in de HTML tekst
      const namePageLink = findNamePageLink(links, html, name, lang)
      
      if (namePageLink) {
        console.log(`[nameAPI] [${lang.toUpperCase()}] Found name page link: ${namePageLink}`)
        return await tryFetchWikipediaPage(namePageLink, lang, name)
      }
    }

    // Geen doorverwijspagina of geen bruikbare link gevonden
    return EMPTY_RESULT

  } catch (error) {
    console.error(`[nameAPI] [${lang.toUpperCase()}] Redirect detection error:`, error)
    return EMPTY_RESULT
  }
}

/**
 * Zoekt naar een link naar een voornaam-pagina in de links en HTML
 */
function findNamePageLink(
  links: Array<{ '*': string }>,
  html: string,
  originalName: string,
  lang: 'nl' | 'en'
): string | null {
  // Patronen om te zoeken in link-titels
  const urlPatterns = lang === 'nl'
    ? ['(voornaam)', '(naam)']
    : ['(given name)', '(given_name)', '(name)', '(first name)']

  // Zoek eerst in de API links
  for (const link of links) {
    const title = link['*'] || ''
    const lowerTitle = title.toLowerCase()
    
    if (urlPatterns.some(pattern => lowerTitle.includes(pattern.toLowerCase()))) {
      return title
    }
  }

  // Zoek in de HTML naar tekst die verwijst naar een voornaam
  // Bijv: "Filip, verkorte vorm van de voornaam"
  const textPatterns = lang === 'nl'
    ? [/voornaam/i, /eigennaam/i, /roepnaam/i, /meisjesnaam/i, /jongensnaam/i]
    : [/given name/i, /first name/i, /forename/i]

  // Zoek links in de HTML die in de buurt staan van voornaam-tekst
  const linkRegex = /<a[^>]+href="\/wiki\/([^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    const title = match[2]
    const linkText = match[3]
    
    // Check de context rondom de link (50 karakters ervoor en erna)
    const startIdx = Math.max(0, match.index - 50)
    const endIdx = Math.min(html.length, match.index + match[0].length + 50)
    const context = html.substring(startIdx, endIdx)
    
    // Als de context een voornaam-patroon bevat, en de link is niet een datum/jaar
    if (textPatterns.some(pattern => pattern.test(context))) {
      // Filter uit: jaren, datums, algemene woorden
      if (!/^\d{4}$/.test(linkText) && !href.includes(':') && linkText.length > 2) {
        // Decodeer de URL
        const decodedTitle = decodeURIComponent(href.replace(/_/g, ' '))
        console.log(`[nameAPI] Found potential name link via context: "${decodedTitle}"`)
        return decodedTitle
      }
    }
  }

  return null
}

/**
 * Probeert een specifieke Wikipedia pagina op te halen en te parsen
 */
async function tryFetchWikipediaPage(
  pageTitle: string,
  lang: 'nl' | 'en',
  originalName: string
): Promise<WikipediaResult> {
  const baseUrl = lang === 'nl' 
    ? 'https://nl.wikipedia.org/w/api.php'
    : 'https://en.wikipedia.org/w/api.php'

  const apiUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) {
      return EMPTY_RESULT
    }

    const data = await response.json()

    if (data.error) {
      return EMPTY_RESULT
    }

    if (!data.parse?.text?.['*']) {
      return EMPTY_RESULT
    }

    const html = data.parse.text['*']
    const fullPageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`

    // Check of het een doorverwijspagina is - zo ja, niet gebruiken
    if (isDisambiguationPage(html, lang)) {
      return EMPTY_RESULT
    }

    // Parse de pagina
    const meaning = parseNameMeaning(html, lang)
    const origin = parseNameOrigin(html, lang)
    const famousPersons = parseFamousPersons(html, lang, originalName)

    // Bepaal of dit een succesvolle lookup was
    const success = !!(meaning || famousPersons.length > 0)

    return {
      meaning,
      origin,
      famousPersons,
      pageUrl: fullPageUrl,
      success
    }
  } catch (error) {
    console.error(`[nameAPI] Fetch error for ${pageTitle}:`, error)
    return EMPTY_RESULT
  }
}

/**
 * Detecteert of een pagina een doorverwijspagina is
 */
function isDisambiguationPage(html: string, lang: 'nl' | 'en'): boolean {
  const markers = lang === 'nl'
    ? ['doorverwijspagina', 'Dit is een doorverwijspagina', 'kan verwijzen naar']
    : ['disambiguation', 'This disambiguation page', 'may refer to', 'disambig']
  
  const lowerHtml = html.toLowerCase()
  return markers.some(marker => lowerHtml.includes(marker.toLowerCase()))
}

/**
 * Parse naambetekenis uit de HTML
 */
function parseNameMeaning(html: string, lang: 'nl' | 'en'): string | null {
  try {
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let match
    let meaningText = ''
    let paragraphCount = 0
    
    while ((match = paragraphRegex.exec(html)) !== null && paragraphCount < 3) {
      const content = match[1]
        .replace(/<sup[^>]*>.*?<\/sup>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (content.length < 20) continue
      if (content.startsWith('thumb|') || content.includes('miniatur|')) continue
      
      paragraphCount++
      meaningText += content + ' '
    }

    meaningText = meaningText.trim()
    
    if (!meaningText) return null

    const meaningIndicators = lang === 'nl'
      ? ['betekent', 'betekenis', 'afgeleid van', 'komt van', 'afkomstig', 'Hebreeuwse', 'Griekse', 'Latijnse', 'Germaanse', 'is een']
      : ['means', 'meaning', 'derived from', 'comes from', 'origin', 'Hebrew', 'Greek', 'Latin', 'Germanic', 'is a']

    const hasMeaningInfo = meaningIndicators.some(indicator => 
      meaningText.toLowerCase().includes(indicator.toLowerCase())
    )

    if (hasMeaningInfo || meaningText.length > 50) {
      if (meaningText.length > 500) {
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
      if (origin.length > 2 && origin.length < 30) {
        return origin
      }
    }
  }

  return null
}

/**
 * Parse bekende naamdragers uit de HTML
 * Met filtering voor niet-personen (plaatsen, etc.)
 */
function parseFamousPersons(
  html: string, 
  lang: 'nl' | 'en',
  originalName: string
): FamousPerson[] {
  const persons: FamousPerson[] = []
  
  try {
    const sectionHeaders = lang === 'nl'
      ? ['Bekende naamdragers', 'Bekende personen', 'Naamdragers', 'Bekende mensen']
      : ['Notable people', 'People with the given name', 'People named', 'Famous people', 'Notable persons', 'People with this name']

    let sectionHtml = ''
    
    for (const header of sectionHeaders) {
      const headerPatterns = [
        new RegExp(`<h[23][^>]*>\\s*(?:<[^>]+>)*\\s*${escapeRegex(header)}\\s*(?:<[^>]+>)*\\s*</h[23]>([\\s\\S]*?)(?=<h[23]|$)`, 'i'),
        new RegExp(`id="[^"]*${escapeRegex(header.replace(/ /g, '_'))}[^"]*"[^>]*>([\\s\\S]*?)(?=<h[23]|$)`, 'i')
      ]
      
      for (const pattern of headerPatterns) {
        const match = html.match(pattern)
        if (match) {
          sectionHtml = match[1] || match[0]
          break
        }
      }
      
      if (sectionHtml) break
    }

    if (!sectionHtml) {
      sectionHtml = html
    }

    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    // Woorden die aangeven dat het GEEN persoon is
    const nonPersonIndicators = lang === 'nl'
      ? ['county', 'plaats', 'stad', 'dorp', 'gemeente', 'park', 'rivier', 'berg', 'eiland', 'gebied', 'streek', 'provincie', 'staat', 'district', 'regio']
      : ['county', 'place', 'city', 'town', 'village', 'municipality', 'park', 'river', 'mountain', 'island', 'area', 'region', 'province', 'state', 'district', 'township', 'census-designated', 'unincorporated']

    while ((match = listItemRegex.exec(sectionHtml)) !== null) {
      const item = match[1]
      
      const linkMatch = item.match(/<a\s+href="([^"]*)"[^>]*(?:\s+title="([^"]*)")?[^>]*>([^<]+)<\/a>/)
      
      if (!linkMatch) continue
      
      const href = linkMatch[1]
      const title = linkMatch[2] || linkMatch[3]
      const linkText = linkMatch[3]
      
      // Skip categorieën, jaren, etc.
      if (href.includes(':') && !href.includes('/wiki/')) continue
      if (/^\d{4}$/.test(linkText)) continue
      if (linkText.length < 3) continue
      
      // Haal beschrijving
      let description = item
        .replace(/<sup[^>]*>.*?<\/sup>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      description = description.replace(linkText, '').replace(/^[\s,\-–—:]+/, '').trim()
      
      // Filter niet-personen op basis van beschrijving
      const lowerDesc = description.toLowerCase()
      const lowerTitle = title.toLowerCase()
      const isNonPerson = nonPersonIndicators.some(indicator => 
        lowerDesc.includes(indicator) || lowerTitle.includes(indicator)
      )
      
      if (isNonPerson) {
        console.log(`[nameAPI] Filtered out non-person: ${linkText} (${description})`)
        continue
      }
      
      // Verkort beschrijving
      if (description.length > 150) {
        const firstPart = description.substring(0, 150)
        const lastSpace = firstPart.lastIndexOf(' ')
        description = firstPart.substring(0, lastSpace) + '...'
      }
      
      if (!description || description.length < 3) {
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

    console.log(`[nameAPI] [${lang.toUpperCase()}] Found ${persons.length} famous persons (after filtering)`)
  } catch (error) {
    console.error(`[nameAPI] Error parsing famous persons:`, error)
  }

  return persons
}

/**
 * Combineert resultaten van NL en EN Wikipedia
 */
function combineResults(
  firstName: string,
  nlResult: WikipediaResult,
  enResult: WikipediaResult
): NameData {
  // Betekenis: prefereer NL, fallback naar EN
  const meaning = nlResult.meaning || enResult.meaning
  const origin = nlResult.origin || enResult.origin

  // Bekende personen: NL eerst, dan EN erbij (zonder duplicaten)
  const allPersons: FamousPerson[] = []
  const seenNames = new Set<string>()

  for (const person of nlResult.famousPersons) {
    const lowerName = person.name.toLowerCase()
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName)
      allPersons.push(person)
    }
  }

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
      nl: nlResult.pageUrl,
      en: enResult.pageUrl
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
```

---

### 📋 Samenvatting - Klaar om te deployen!

**Aangepaste bestanden** (1):
1. `lib/nameAPI.ts` - Volledig herschreven met verbeterde logica

**Wat is veranderd:**

1. **Strikte fallback i.p.v. parallel**
   - NL wordt eerst volledig geprobeerd
   - Alleen als NL niets oplevert → EN proberen
   - Lost Martijn-probleem op

2. **Streepjesnamen fallback**
   - Als "Jan-Peter" niets oplevert → "Jan" proberen
   - Lost Jan-Peter gedeeltelijk op

3. **Slimmere doorverwijzing**
   - Scant niet alleen URL's maar ook linktekst
   - Zoekt naar "voornaam", "roepnaam", etc. in context
   - Lost Flip → Filip op

4. **Personen-filter**
   - Filtert plaatsen, counties, parken, etc. uit bekende naamdragers
   - Lost Jasper-probleem op

**Git commit message:**
```
fix: improved name lookup with strict fallback and better filtering

- Strict NL→EN fallback instead of parallel (fixes Martijn)
- Hyphenated name fallback: Jan-Peter → Jan
- Smarter redirect detection scanning link text for "voornaam"
- Filter non-persons (places, counties) from famous namesakes