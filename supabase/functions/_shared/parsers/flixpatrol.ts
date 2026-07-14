// supabase/functions/_shared/parsers/flixpatrol.ts
// Pure parser voor flixpatrol.com top 10-pagina's.

import { cleanText } from '../html.ts'

export interface StreamingEntry {
  rank: number
  title: string
  platform: string
  contentType: string | null // 'film' | 'serie' | null (onbekend)
}

// Platform-secties zoals FlixPatrol ze in section-id's/koppen gebruikt
const PLATFORMS: Array<{ id: string; name: string }> = [
  { id: 'netflix', name: 'Netflix' },
  { id: 'hbo', name: 'HBO Max' },
  { id: 'max', name: 'HBO Max' },
  { id: 'disney', name: 'Disney+' },
  { id: 'amazon-prime', name: 'Prime Video' },
  { id: 'amazon', name: 'Prime Video' },
  { id: 'apple-tv', name: 'Apple TV+' },
  { id: 'videoland', name: 'Videoland' },
]

/**
 * Parse de FlixPatrol top 10-pagina voor Nederland.
 *
 * De pagina bevat per platform een sectie (anker-id zoals #netflix) met twee
 * tabellen: Movies en TV Shows. Elke rij linkt naar /title/... met de titel
 * als linktekst en het ranknummer in de eerste kolom.
 */
export function parseFlixPatrol(html: string): StreamingEntry[] {
  const entries: StreamingEntry[] = []

  for (const platform of PLATFORMS) {
    const anchorRegex = new RegExp(`id=["']${platform.id}["']`, 'i')
    const anchorMatch = anchorRegex.exec(html)
    if (!anchorMatch) continue

    const rest = html.slice(anchorMatch.index)
    const nextSection = rest.slice(100).search(/id=["'][a-z-]+["'][^>]*>\s*<h2/i)
    const section = nextSection > 0 ? rest.slice(0, nextSection + 100) : rest

    // Binnen de sectie: splits op tabelkoppen zodat we film/serie weten
    const tableRegex = /(Movies|TV Shows|Films|Series)([\s\S]*?)(?=(Movies|TV Shows|Films|Series)|$)/g
    let tableMatch: RegExpExecArray | null
    while ((tableMatch = tableRegex.exec(section)) !== null) {
      const heading = tableMatch[1]
      const contentType = /movie|film/i.test(heading) ? 'film' : 'serie'
      const body = tableMatch[2]

      const rowRegex = /<tr[\s\S]*?>[\s\S]*?(\d+)\.?[\s\S]*?<a[^>]*href="\/title\/[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/g
      let rowMatch: RegExpExecArray | null
      while ((rowMatch = rowRegex.exec(body)) !== null) {
        const rank = parseInt(rowMatch[1], 10)
        const title = cleanText(rowMatch[2])
        if (!title || !Number.isFinite(rank) || rank < 1 || rank > 10) continue

        const duplicate = entries.some(
          (e) => e.platform === platform.name && e.rank === rank && e.contentType === contentType
        )
        if (!duplicate) {
          entries.push({ rank, title, platform: platform.name, contentType })
        }
      }
    }
  }

  // Fallback: geen platform-secties gevonden — parse alle /title/-links met
  // een rangnummer ervoor en label ze als gecombineerde lijst.
  if (entries.length === 0) {
    const genericRegex = /(\d+)\.?\s*(?:<[^>]+>\s*)*<a[^>]*href="\/title\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g
    let match: RegExpExecArray | null
    while ((match = genericRegex.exec(html)) !== null && entries.length < 10) {
      const rank = parseInt(match[1], 10)
      const title = cleanText(match[2])
      if (!title || !Number.isFinite(rank) || rank < 1 || rank > 10) continue
      if (!entries.some((e) => e.rank === rank)) {
        entries.push({ rank, title, platform: 'Gecombineerd', contentType: null })
      }
    }
  }

  return entries
}
