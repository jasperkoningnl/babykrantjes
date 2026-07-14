// supabase/functions/_shared/parsers/tvgids.ts
// Pure parser voor tvgids.nl zenderpagina's.

import { cleanText, decodeHtmlEntities } from '../html.ts'

export interface TvProgram {
  timeSlot: string // 'HH:MM'
  name: string
  genre: string | null
  description: string | null
}

/**
 * Parse de programmalijst van een tvgids.nl zenderpagina.
 *
 * De pagina bevat gestructureerde data in twee vormen; we proberen ze in
 * volgorde en nemen het eerste patroon dat resultaten oplevert:
 *
 * 1. JSON-LD (schema.org BroadcastEvent / TVEpisode) in <script> tags
 * 2. HTML-lijst: programma-links met een tijd (HH:MM) en de titel in
 *    child-elementen
 */
export function parseTvGidsPage(html: string): TvProgram[] {
  const programs: TvProgram[] = []

  // Patroon 1: JSON-LD blokken
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const events = Array.isArray(parsed) ? parsed : [parsed]
      for (const event of events) {
        const items = Array.isArray(event?.itemListElement)
          ? event.itemListElement.map((el: Record<string, unknown>) => el?.item ?? el)
          : [event]
        for (const item of items) {
          const name = typeof item?.name === 'string' ? cleanText(item.name) : null
          const start = typeof item?.startDate === 'string' ? item.startDate : null
          if (!name || !start) continue
          const timeMatch = start.match(/T(\d{2}:\d{2})/)
          if (!timeMatch) continue
          programs.push({
            timeSlot: timeMatch[1],
            name,
            genre: typeof item?.genre === 'string' ? cleanText(item.genre) : null,
            description: typeof item?.description === 'string' ? cleanText(item.description) : null,
          })
        }
      }
    } catch {
      // Geen geldige JSON in dit blok: negeren, volgende blok proberen
    }
  }
  if (programs.length > 0) return programs

  // Patroon 2: tijd + titel in de HTML-lijst.
  const itemRegex = /<a[^>]*href="[^"]*\/(?:programma|tv\/uitzending)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1]
    const timeMatch = block.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)
    if (!timeMatch) continue
    const timeSlot = `${timeMatch[1]}:${timeMatch[2]}`

    // Titel: langste tekstfragment in het blok dat geen tijd is
    const texts = block
      .split(/<[^>]+>/)
      .map((t) => decodeHtmlEntities(t).replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 1 && !/^\d{2}:\d{2}/.test(t) && !/^\d+$/.test(t))
    if (texts.length === 0) continue

    const name = texts.reduce((a, b) => (b.length > a.length ? b : a), '')
    if (!name) continue

    programs.push({ timeSlot, name, genre: null, description: null })
  }

  return programs
}
