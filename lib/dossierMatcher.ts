// lib/dossierMatcher.ts
// @version 1.0.0
// Matches news headlines of a specific date against long-running news dossiers
// (wars, crises, disasters) from data/dossiers.json, so the generated news
// section can add context ("part of the war that started in ...").
//
// Design:
// - Deterministic keyword/alias matching, no AI calls. The article generator
//   (Claude) receives the matched dossier context in its prompt and weaves it in.
// - A dossier only matches when it was active on the given date (start/eind).
// - Matching is case-insensitive, diacritic-insensitive and on word boundaries,
//   so "Oekraïne" matches alias "oekraine" but "coronation" does not match "corona".

import dossierData from '../data/dossiers.json'

export interface Dossier {
  id: string
  naam: string
  /** First day the dossier is considered active (YYYY-MM-DD). */
  start: string
  /** Last active day (YYYY-MM-DD), or null while the dossier is ongoing. */
  eind: string | null
  aliassen: string[]
  /** 2-3 sentence background paragraph, used as building block in the prompt. */
  context: string
}

export interface DossierMatch {
  dossier: Dossier
  /** Headlines of the day that triggered this match, in input order. */
  headlines: string[]
  /** Aliases that matched, for debugging/telemetry. */
  aliassen: string[]
}

/** Lowercase and strip diacritics so "Oekraïne" === "oekraine". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Word-boundary regex for a (normalized) alias. \b is unreliable for
 * non-ASCII, so we require a non-letter/digit (or string edge) on both sides.
 */
function aliasRegex(alias: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`,
    'u'
  )
}

interface CompiledDossier {
  dossier: Dossier
  patterns: Array<{ alias: string; regex: RegExp }>
}

const COMPILED: CompiledDossier[] = (dossierData.dossiers as Dossier[]).map(
  (dossier) => ({
    dossier,
    patterns: dossier.aliassen.map((alias) => {
      const normalized = normalize(alias)
      return { alias: normalized, regex: aliasRegex(normalized) }
    }),
  })
)

/** True when the dossier was active on the given date (YYYY-MM-DD). */
export function isDossierActiveOn(dossier: Dossier, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (date < dossier.start) return false
  if (dossier.eind && date > dossier.eind) return false
  return true
}

/**
 * Match the day's headlines against dossiers that were active on that date.
 * Returns one entry per matched dossier with the headlines that triggered it.
 * Headlines that match nothing simply don't appear; no match means no context
 * (the news section then renders as before).
 */
export function matchDossiers(headlines: string[], date: string): DossierMatch[] {
  const matches: DossierMatch[] = []
  const normalizedHeadlines = headlines
    .map((h) => ({ original: h, normalized: normalize(h) }))
    .filter((h) => h.normalized.trim().length > 0)

  for (const { dossier, patterns } of COMPILED) {
    if (!isDossierActiveOn(dossier, date)) continue

    const matchedHeadlines: string[] = []
    const matchedAliases = new Set<string>()

    for (const headline of normalizedHeadlines) {
      let headlineMatched = false
      for (const { alias, regex } of patterns) {
        if (regex.test(headline.normalized)) {
          headlineMatched = true
          matchedAliases.add(alias)
        }
      }
      if (headlineMatched) matchedHeadlines.push(headline.original)
    }

    if (matchedHeadlines.length > 0) {
      matches.push({
        dossier,
        headlines: matchedHeadlines,
        aliassen: Array.from(matchedAliases),
      })
    }
  }

  return matches
}

/** Dutch period label for the prompt, e.g. "sinds februari 2022" or "maart 2011 – december 2011". */
export function formatDossierPeriode(dossier: Dossier): string {
  const monthYear = (isoDate: string): string =>
    new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('nl-NL', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  if (!dossier.eind) return `sinds ${monthYear(dossier.start)}`
  return `${monthYear(dossier.start)} – ${monthYear(dossier.eind)}`
}

/**
 * Prompt block for the news section. Empty string when nothing matched, so the
 * existing prompt stays byte-for-byte identical on days without dossier news.
 */
export function buildDossierPromptBlock(matches: DossierMatch[]): string {
  if (matches.length === 0) return ''

  const items = matches
    .map((match) => {
      const koppen = match.headlines.map((h) => `"${h}"`).join('; ')
      return `- ${match.dossier.naam} (${formatDossierPeriode(match.dossier)}): ${match.dossier.context}\n  Koppen van deze dag hierover: ${koppen}`
    })
    .join('\n')

  return `LOPENDE DOSSIERS (achtergrond bij het nieuws van deze dag):
Sommige koppen van deze dag horen bij een groter, langer lopend nieuwsverhaal. Als je zo'n kop selecteert, verwerk dan kort (max 1 zin) de achtergrond zodat de lezer het grotere verhaal begrijpt — bijvoorbeeld sinds wanneer het speelt. Gebruik de achtergrond alleen bij koppen die er echt over gaan, en alleen bij nieuws van deze dag zelf.

${items}

`
}
