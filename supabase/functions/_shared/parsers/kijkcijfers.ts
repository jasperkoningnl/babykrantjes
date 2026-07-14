// supabase/functions/_shared/parsers/kijkcijfers.ts
// Pure parser voor kijkonderzoek.nl.

import { cleanText, DUTCH_MONTHS } from '../html.ts'

export interface RatingEntry {
  rank: number
  programName: string
  channel: string | null
  viewers: number | null
}

/**
 * Parseert de Top 25-tabel van kijkonderzoek.nl.
 * Rijstructuur:
 *   <td class='kc_cdcb'>1</td>
 *   <td class='kc_cdtitle'>PROGRAMMA TITEL</td>
 *   <td class='kc_cdstation'>RTL 4</td>
 *   <td class='kc_cdrt0'>2.567.000</td>   (gemiddeld aantal kijkers)
 *   <td class='kc_cdrt0'>3.599.000</td>   (totaal)
 */
export function parseKijkcijfers(html: string, maxRank = 20): RatingEntry[] {
  const ratings: RatingEntry[] = []
  const rowRegex =
    /<td class=['"]kc_cdcb['"]>(\d+)<\/td>\s*<td class=['"]kc_cdtitle['"]>([^<]+)<\/td>\s*<td class=['"]kc_cdstation['"]>([^<]+)<\/td>\s*<td class=['"]kc_cdrt0['"]>([\d.]+)<\/td>/gi

  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(html)) !== null) {
    const rank = parseInt(match[1], 10)
    if (rank < 1 || rank > maxRank) continue

    const viewers = parseInt(match[4].replace(/\./g, ''), 10)
    ratings.push({
      rank,
      programName: cleanText(match[2]),
      channel: match[3].trim() || null,
      viewers: Number.isFinite(viewers) ? viewers : null,
    })
  }

  return ratings
}

/**
 * Datum uit de pagina-header, ter validatie dat we de juiste dag te pakken
 * hebben. Formaat: <td class='kc_headerright'>woensdag 24 december 2025</td>
 */
export function extractPageDate(html: string): string | null {
  const dateMatch = html.match(/<td class=['"]kc_headerright['"]>(?:\w+\s+)?(\d+)\s+(\w+)\s+(\d{4})<\/td>/i)
  if (!dateMatch) return null
  const [, day, monthName, year] = dateMatch
  const month = DUTCH_MONTHS[monthName.toLowerCase()]
  if (!month) return null
  return `${year}-${month}-${day.padStart(2, '0')}`
}
