// supabase/functions/_shared/parsers/top40.ts
// Pure parser voor top40.nl.

import { cleanText, decodeHtmlEntities } from '../html.ts'

export interface ChartEntry {
  rank: number
  title: string
  artist: string
}

/**
 * Parse de actuele Top 40-lijst van top40.nl.
 *
 * Primair patroon (zelfde structuur als de bestaande Next.js route):
 *   <a href="/artiest-slug/titel-slug-12345">
 *     <h2>Titel</h2>
 *     <h3>Artiest</h3>
 *   </a>
 * Fallback: class-based structuur met "title"/"artist" classes.
 */
export function parseTop40(html: string): ChartEntry[] {
  const entries: ChartEntry[] = []

  const h2h3Pattern = /<a[^>]*href="\/([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi
  let match: RegExpExecArray | null
  while ((match = h2h3Pattern.exec(html)) !== null && entries.length < 40) {
    const title = decodeHtmlEntities(match[2].trim())
    const artist = decodeHtmlEntities(match[3].trim())
    if (title && artist && match[1].includes('/')) {
      entries.push({ rank: entries.length + 1, title, artist })
    }
  }

  if (entries.length === 0) {
    const classPattern =
      /<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\//gi
    while ((match = classPattern.exec(html)) !== null && entries.length < 40) {
      const title = cleanText(match[1])
      const artist = cleanText(match[2])
      if (title && artist) {
        entries.push({ rank: entries.length + 1, title, artist })
      }
    }
  }

  return entries
}
