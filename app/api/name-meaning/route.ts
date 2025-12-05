// app/api/name-meaning/route.ts
// @version 1.0.3
// Server-side API route voor naambetekenis
// Lost CORS problemen op door requests vanaf server te doen
// Fix: ondersteunt nu zowel prose-pink (meisjes) als prose-blue (jongens)

import { NextRequest, NextResponse } from 'next/server'

export interface NameMeaningData {
  firstName: string
  meaning: string | null
  origin: string | null
  gender: string | null
  source: string | null
}

/**
 * GET /api/name-meaning?name=...
 * Haalt naambetekenis op van naamdokter.nl (primair) of betekenisnamen.nl (fallback)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fullName = searchParams.get('name')

  if (!fullName) {
    return NextResponse.json({ error: 'Name parameter required' }, { status: 400 })
  }

  const firstName = extractFirstName(fullName)
  
  const emptyResult: NameMeaningData = {
    firstName,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  if (!firstName) {
    return NextResponse.json(emptyResult)
  }

  // Probeer naamdokter.nl eerst
  const naamdokterResult = await tryNaamdokter(firstName)
  if (naamdokterResult.meaning) {
    return NextResponse.json(naamdokterResult)
  }

  // Fallback naar betekenisnamen.nl
  const betekenisResult = await tryBetekenisNamen(firstName)
  if (betekenisResult.meaning) {
    return NextResponse.json(betekenisResult)
  }

  // Geen resultaat gevonden
  return NextResponse.json(emptyResult)
}

/**
 * Probeert naamdokter.nl
 */
async function tryNaamdokter(name: string): Promise<NameMeaningData> {
  const emptyResult: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    // Naamdokter gebruikt /name/ (Engels) met lowercase namen
    const url = `https://naamdokter.nl/name/${name.toLowerCase()}/`
    console.log(`[Naamdokter] Fetching: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9'
      },
      next: { revalidate: 86400 } // Cache 24 uur
    })

    if (!response.ok) {
      console.log(`[Naamdokter] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()
    
    // Parse de pagina eerst - als we content vinden, bestaat de pagina
    const result = parseNaamdokterHtml(html, name)
    
    if (result.meaning) {
      result.source = url
      console.log(`[Naamdokter] Success for ${name}: ${result.meaning.substring(0, 50)}...`)
    } else {
      console.log(`[Naamdokter] No content found for ${name}`)
    }
    
    return result

  } catch (error) {
    console.error(`[Naamdokter] Error for ${name}:`, error)
    return emptyResult
  }
}

/**
 * Probeert betekenisnamen.nl
 */
async function tryBetekenisNamen(name: string): Promise<NameMeaningData> {
  const emptyResult: NameMeaningData = {
    firstName: name,
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  try {
    // Betekenisnamen gebruikt lowercase met eerste letter uppercase
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    const url = `https://www.betekenisnamen.nl/naam/${formattedName}`
    console.log(`[BetekenisNamen] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      next: { revalidate: 86400 }
    })

    if (!response.ok) {
      console.log(`[BetekenisNamen] HTTP ${response.status} for ${name}`)
      return emptyResult
    }

    const html = await response.text()
    const result = parseBetekenisNamenHtml(html, name)
    
    if (result.meaning) {
      result.source = url
      console.log(`[BetekenisNamen] Success for ${name}`)
    }
    
    return result

  } catch (error) {
    console.error(`[BetekenisNamen] Error for ${name}:`, error)
    return emptyResult
  }
}

/**
 * Parset naamdokter.nl HTML
 * Ondersteunt zowel prose-pink (meisjesnamen) als prose-blue (jongensnamen)
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
    // Naamdokter gebruikt prose-pink voor meisjes, prose-blue voor jongens
    // Regex: prose prose-(pink|blue)
    const proseMatch = html.match(/<div[^>]*class="[^"]*prose\s+prose-(?:pink|blue)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    
    if (proseMatch) {
      let content = proseMatch[1]
      
      // Verwijder HTML tags maar behoud structuur
      content = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<strong>/gi, '')
        .replace(/<\/strong>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/\\"/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim()

      content = decodeHtmlEntities(content)

      if (content.length > 50) {
        // Neem max 800 karakters voor een rijke beschrijving
        result.meaning = content.substring(0, 800).trim()
        if (content.length > 800) {
          // Knip af bij laatste zin
          const lastPeriod = result.meaning.lastIndexOf('.')
          if (lastPeriod > 400) {
            result.meaning = result.meaning.substring(0, lastPeriod + 1)
          } else {
            result.meaning += '...'
          }
        }
      }
    }

    // Zoek naar geslacht - format: <strong class="text-pink-600">Geslacht:</strong> Vrouw
    // Of: <strong class="text-blue-600">Geslacht:</strong> Man
    const genderMatch = html.match(/>Geslacht:<\/strong>\s*(?:<!--[^>]*-->)?\s*([^<]+)/i)
    if (genderMatch) {
      result.gender = genderMatch[1].trim()
    }

    // Zoek naar herkomst - format: <strong class="text-pink-600">Herkomst:</strong> ...
    // Of: <strong class="text-blue-600">Herkomst:</strong> ...
    const originMatch = html.match(/>Herkomst:<\/strong>\s*(?:<!--[^>]*-->)?\s*([^<]+)/i)
    if (originMatch) {
      result.origin = originMatch[1].trim()
    }

    // Als geen prose gevonden, probeer meta description
    if (!result.meaning) {
      const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
      if (metaMatch) {
        const desc = decodeHtmlEntities(metaMatch[1])
        // Filter generieke meta descriptions
        if (desc.length > 30 && 
            !desc.includes('404') && 
            !desc.includes('Ontdek alles over de naam')) {
          result.meaning = desc
        }
      }
    }

    console.log(`[Naamdokter] Parsed - meaning: ${result.meaning ? 'found (' + result.meaning.length + ' chars)' : 'not found'}, gender: ${result.gender}, origin: ${result.origin}`)

  } catch (error) {
    console.error('[Naamdokter] Parse error:', error)
  }

  return result
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
    // Zoek naar betekenis sectie - meestal in een specifieke div
    // Format: <h2>Betekenis</h2> ... <p>betekenis tekst</p>
    const meaningMatch = html.match(/Betekenis[^<]*<\/h[23]>\s*(?:<[^>]+>)*\s*<p[^>]*>([^<]+)/i)
    if (meaningMatch) {
      result.meaning = decodeHtmlEntities(meaningMatch[1].trim())
    }

    // Alternatief: zoek in de intro paragraph
    if (!result.meaning) {
      const introMatch = html.match(/<p[^>]*class="[^"]*intro[^"]*"[^>]*>([^<]+)/i)
      if (introMatch) {
        result.meaning = decodeHtmlEntities(introMatch[1].trim())
      }
    }

    // Zoek naar geslacht
    const genderMatch = html.match(/(?:Geslacht|Type)[^<]*<\/[^>]+>\s*<[^>]+>([^<]*(?:Jongensnaam|Meisjesnaam|Unisex)[^<]*)/i)
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

/**
 * Extraheert de eerste voornaam uit een volledige naam
 */
function extractFirstName(fullName: string): string {
  if (!fullName || fullName.trim() === '') return ''
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 0 ? parts[0] : ''
}