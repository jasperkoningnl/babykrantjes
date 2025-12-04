// app/api/name-meaning/route.ts
// @version 1.0.0
// Server-side API route voor naambetekenis
// Lost CORS problemen op door requests vanaf server te doen

import { NextRequest, NextResponse } from 'next/server'

export interface NameMeaningData {
  firstName: string
  meaning: string | null
  origin: string | null
  gender: string | null
  source: string | null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fullName = searchParams.get('name')

  if (!fullName) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 }
    )
  }

  const result = await getNameMeaning(fullName)
  return NextResponse.json(result)
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
 * Hoofdfunctie: haalt naambetekenis op
 * Probeert eerst naamdokter.nl, dan betekenisnamen.nl als fallback
 */
async function getNameMeaning(fullName: string): Promise<NameMeaningData> {
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

  console.log(`[NameMeaning] Looking up: "${firstName}"`)

  // Probeer naamdokter.nl eerst (rijkere beschrijvingen)
  const naamdokterResult = await fetchFromNaamdokter(firstName)
  if (naamdokterResult.meaning) {
    console.log(`[NameMeaning] Found on naamdokter.nl`)
    return naamdokterResult
  }

  // Fallback naar betekenisnamen.nl
  console.log(`[NameMeaning] Trying fallback: betekenisnamen.nl`)
  const betekenisResult = await fetchFromBetekenisNamen(firstName)
  if (betekenisResult.meaning) {
    console.log(`[NameMeaning] Found on betekenisnamen.nl`)
    return betekenisResult
  }

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
async function fetchFromNaamdokter(name: string): Promise<NameMeaningData> {
  const emptyResult: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    const url = `https://naamdokter.nl/name/${encodeURIComponent(name.toLowerCase())}/`
    console.log(`[Naamdokter] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantjesGenerator/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl,en;q=0.5'
      }
    })

    if (!response.ok) {
      console.log(`[Naamdokter] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()

    // Check of de pagina echt bestaat (niet een 404 pagina of redirect)
    if (html.includes('Pagina niet gevonden') || 
        html.includes('404') ||
        html.includes('niet gevonden')) {
      console.log(`[Naamdokter] Page not found for ${name}`)
      return emptyResult
    }

    // Parse de pagina
    const result = parseNaamdokterHtml(html, name)
    if (result.meaning) {
      result.source = url
    }
    return result

  } catch (error) {
    console.error(`[Naamdokter] Error fetching ${name}:`, error)
    return emptyResult
  }
}

/**
 * Parset naamdokter.nl HTML
 */
function parseNaamdokterHtml(html: string, name: string): NameMeaningData {
  const result: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    // Zoek naar de prose sectie met de betekenis
    // Naamdokter gebruikt prose-blue classes voor de hoofdtekst
    const proseMatch = html.match(/<div[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
    
    if (proseMatch) {
      let content = proseMatch[1]
      
      // Verwijder HTML tags maar behoud structuur
      content = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      content = decodeHtmlEntities(content)

      if (content.length > 50) {
        result.meaning = content.substring(0, 500).trim()
        if (content.length > 500) {
          result.meaning += '...'
        }
      }
    }

    // Zoek naar geslacht
    const genderMatch = html.match(/Geslacht:<\/strong>\s*([^<]+)/i)
    if (genderMatch) {
      result.gender = genderMatch[1].trim()
    }

    // Zoek naar herkomst
    const originMatch = html.match(/Herkomst:<\/strong>\s*([^<]+)/i)
    if (originMatch) {
      result.origin = originMatch[1].trim()
    }

    // Als geen prose gevonden, probeer meta description
    if (!result.meaning) {
      const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
      if (metaMatch) {
        const desc = decodeHtmlEntities(metaMatch[1])
        if (desc.length > 30 && !desc.includes('404')) {
          result.meaning = desc
        }
      }
    }

  } catch (error) {
    console.error('[Naamdokter] Parse error:', error)
  }

  return result
}

/**
 * Haalt naambetekenis op van betekenisnamen.nl
 */
async function fetchFromBetekenisNamen(name: string): Promise<NameMeaningData> {
  const emptyResult: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    const url = `https://www.betekenisnamen.nl/naam/${encodeURIComponent(name.toLowerCase())}`
    console.log(`[BetekenisNamen] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantjesGenerator/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl,en;q=0.5'
      }
    })

    if (!response.ok) {
      console.log(`[BetekenisNamen] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()

    // Check of de pagina bestaat
    if (html.includes('Pagina niet gevonden') || 
        html.includes('bestaat niet') ||
        html.includes('geen resultaten')) {
      console.log(`[BetekenisNamen] Page not found for ${name}`)
      return emptyResult
    }

    const result = parseBetekenisNamenHtml(html, name)
    if (result.meaning) {
      result.source = url
    }
    return result

  } catch (error) {
    console.error(`[BetekenisNamen] Error fetching ${name}:`, error)
    return emptyResult
  }
}

/**
 * Parset betekenisnamen.nl HTML
 */
function parseBetekenisNamenHtml(html: string, name: string): NameMeaningData {
  const result: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    // Zoek naar de betekenis sectie
    // Format: "Betekenis naam [Name]" gevolgd door de betekenis
    const betekenisMatch = html.match(/Betekenis\s+naam[^<]*<\/h[23]>\s*<p[^>]*>([^<]+)/i)
    if (betekenisMatch) {
      result.meaning = decodeHtmlEntities(betekenisMatch[1].trim())
    }

    // Alternatief: zoek in een card of sectie
    if (!result.meaning) {
      const cardMatch = html.match(/class="[^"]*card[^"]*"[^>]*>[\s\S]*?<p[^>]*>([^<]{20,})</i)
      if (cardMatch) {
        result.meaning = decodeHtmlEntities(cardMatch[1].trim())
      }
    }

    // Zoek naar geslacht in categorieën
    const genderMatch = html.match(/Categorie[^<]*<\/[^>]+>\s*<[^>]+>([^<]*(?:Jongensnaam|Meisjesnaam|Unisex)[^<]*)/i)
    if (genderMatch) {
      const genderText = genderMatch[1].toLowerCase()
      if (genderText.includes('jongensnaam')) {
        result.gender = 'Mannelijk'
      } else if (genderText.includes('meisjesnaam')) {
        result.gender = 'Vrouwelijk'
      } else if (genderText.includes('unisex')) {
        result.gender = 'Unisex'
      }
    }

    // Zoek naar herkomst
    const originMatch = html.match(/(?:Herkomst|Oorsprong)[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)/i)
    if (originMatch) {
      result.origin = decodeHtmlEntities(originMatch[1].trim())
    }

  } catch (error) {
    console.error('[BetekenisNamen] Parse error:', error)
  }

  return result
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}