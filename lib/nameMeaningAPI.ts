// lib/nameMeaningAPI.ts
// @version 1.0.0
// API voor het ophalen van naambetekenis
// Bronnen: naamdokter.nl (primair), betekenisnamen.nl (fallback)

export interface NameMeaningData {
  firstName: string
  meaning: string | null
  origin: string | null
  gender: string | null
  source: string | null
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
 * Hoofdfunctie: haalt naambetekenis op
 * Probeert eerst naamdokter.nl, daarna betekenisnamen.nl als fallback
 */
export async function getNameMeaning(fullName: string): Promise<NameMeaningData> {
  const firstName = extractFirstName(fullName)
  
  if (!firstName) {
    return {
      firstName: '',
      meaning: null,
      origin: null,
      gender: null,
      source: null
    }
  }

  const nameLower = firstName.toLowerCase()
  console.log(`[NameMeaning] Looking up: "${firstName}"`)

  // Stap 1: Probeer naamdokter.nl
  const naamdokterResult = await fetchFromNaamdokter(nameLower)
  if (naamdokterResult.meaning) {
    console.log(`[NameMeaning] Found on naamdokter.nl`)
    return {
      firstName,
      ...naamdokterResult
    }
  }

  // Stap 2: Fallback naar betekenisnamen.nl
  console.log(`[NameMeaning] Trying fallback: betekenisnamen.nl`)
  const betekenisResult = await fetchFromBetekenisNamen(nameLower)
  if (betekenisResult.meaning) {
    console.log(`[NameMeaning] Found on betekenisnamen.nl`)
    return {
      firstName,
      ...betekenisResult
    }
  }

  // Niets gevonden
  console.log(`[NameMeaning] No meaning found for "${firstName}"`)
  return {
    firstName,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }
}

/**
 * Haalt naambetekenis op van naamdokter.nl
 */
async function fetchFromNaamdokter(
  name: string
): Promise<Omit<NameMeaningData, 'firstName'>> {
  const emptyResult = { meaning: null, origin: null, gender: null, source: null }

  try {
    const url = `https://naamdokter.nl/name/${encodeURIComponent(name)}/`
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'BabykrantjesGenerator/1.0',
        'Accept': 'text/html'
      }
    })

    if (!response.ok) {
      console.log(`[Naamdokter] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()

    // Check of de pagina bestaat (geen 404 pagina)
    if (html.includes('Naam niet gevonden') || html.includes('niet vinden in onze database')) {
      console.log(`[Naamdokter] Name not found: ${name}`)
      return emptyResult
    }

    // Parse de data uit de HTML
    return parseNaamdokterHtml(html, url)
  } catch (error) {
    console.error(`[Naamdokter] Error fetching ${name}:`, error)
    return emptyResult
  }
}

/**
 * Parset naamdokter.nl HTML
 * Ze gebruiken Next.js RSC, maar de belangrijke data staat ook in de HTML
 */
function parseNaamdokterHtml(
  html: string,
  sourceUrl: string
): Omit<NameMeaningData, 'firstName'> {
  let meaning: string | null = null
  let origin: string | null = null
  let gender: string | null = null

  try {
    // Geslacht: zoek naar "Geslacht:</strong>" gevolgd door Man of Vrouw
    const genderMatch = html.match(/Geslacht:<\/strong>(?:<\/[^>]+>)?\s*(?:<[^>]+>)*\s*(Man|Vrouw|Meisje|Jongen)/i)
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase()
      gender = (g === 'man' || g === 'jongen') ? 'Mannelijk' : 'Vrouwelijk'
    }

    // Herkomst: zoek naar "Herkomst:</strong>" 
    const originMatch = html.match(/Herkomst:<\/strong>(?:<\/[^>]+>)?\s*(?:<[^>]+>)*\s*([^<]+)/i)
    if (originMatch) {
      origin = decodeHtmlEntities(originMatch[1].trim())
    }

    // Betekenis: zoek naar de prose tekst in de blauwe box
    // Dit is de uitgebreide beschrijving van de naam
    const proseMatch = html.match(/prose prose-blue max-w-none[^>]*>([\s\S]*?)<\/div>/i)
    if (proseMatch) {
      // Parse de paragrafen uit de prose
      const proseHtml = proseMatch[1]
      const paragraphs: string[] = []
      
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
      let pMatch
      while ((pMatch = pRegex.exec(proseHtml)) !== null) {
        const text = pMatch[1]
          .replace(/<strong>/gi, '')
          .replace(/<\/strong>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        
        if (text.length > 20) {
          paragraphs.push(text)
        }
      }

      if (paragraphs.length > 0) {
        // Combineer de eerste paar paragrafen (max 800 chars)
        let combined = ''
        for (const p of paragraphs) {
          if (combined.length + p.length < 800) {
            combined += (combined ? ' ' : '') + p
          } else {
            break
          }
        }
        meaning = decodeHtmlEntities(combined)
      }
    }

    // Als geen prose gevonden, probeer meta description
    if (!meaning) {
      const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
      if (metaMatch) {
        const desc = decodeHtmlEntities(metaMatch[1])
        // Filter alleen als het daadwerkelijk over de naam gaat
        if (desc.includes('betekenis') || desc.includes('oorsprong')) {
          meaning = desc
        }
      }
    }

    return {
      meaning,
      origin,
      gender,
      source: meaning ? sourceUrl : null
    }
  } catch (error) {
    console.error('[Naamdokter] Parse error:', error)
    return { meaning: null, origin: null, gender: null, source: null }
  }
}

/**
 * Haalt naambetekenis op van betekenisnamen.nl
 */
async function fetchFromBetekenisNamen(
  name: string
): Promise<Omit<NameMeaningData, 'firstName'>> {
  const emptyResult = { meaning: null, origin: null, gender: null, source: null }

  try {
    const url = `https://www.betekenisnamen.nl/naam/${encodeURIComponent(name)}`
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'BabykrantjesGenerator/1.0',
        'Accept': 'text/html'
      }
    })

    if (!response.ok) {
      console.log(`[BetekenisNamen] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()

    // Check of de pagina bestaat
    if (html.includes('niet gevonden') || response.url.includes('/search')) {
      console.log(`[BetekenisNamen] Name not found: ${name}`)
      return emptyResult
    }

    return parseBetekenisNamenHtml(html, url)
  } catch (error) {
    console.error(`[BetekenisNamen] Error fetching ${name}:`, error)
    return emptyResult
  }
}

/**
 * Parset betekenisnamen.nl HTML
 */
function parseBetekenisNamenHtml(
  html: string,
  sourceUrl: string
): Omit<NameMeaningData, 'firstName'> {
  let meaning: string | null = null
  let origin: string | null = null
  let gender: string | null = null

  try {
    // Geslacht: zoek naar "Categorieën" sectie
    const genderMatch = html.match(/<h2[^>]*>Categorie[^<]*<\/h2>\s*<p>([^<]+)/i)
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase()
      if (g.includes('mannelijk') || g.includes('man') || g.includes('jongen')) {
        gender = 'Mannelijk'
      } else if (g.includes('vrouwelijk') || g.includes('vrouw') || g.includes('meisje')) {
        gender = 'Vrouwelijk'
      }
    }

    // Betekenis: zoek naar "Betekenis naam" sectie
    const meaningMatch = html.match(/<h2[^>]*>Betekenis naam<\/h2>\s*<p>([^<]+)/i)
    if (meaningMatch) {
      meaning = decodeHtmlEntities(meaningMatch[1].trim())
    }

    // Als er ook een intro-paragraaf is, voeg die toe voor context
    const introMatch = html.match(/<h1>[^<]+<\/h1>\s*<p>([\s\S]*?)<\/p>/i)
    if (introMatch && meaning) {
      const intro = introMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Combineer intro met betekenis voor rijkere context
      if (intro.length > 50 && intro.length < 500) {
        meaning = decodeHtmlEntities(intro)
      }
    }

    return {
      meaning,
      origin,
      gender,
      source: meaning ? sourceUrl : null
    }
  } catch (error) {
    console.error('[BetekenisNamen] Parse error:', error)
    return { meaning: null, origin: null, gender: null, source: null }
  }
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
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
}