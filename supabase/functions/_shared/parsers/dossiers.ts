// supabase/functions/_shared/parsers/dossiers.ts
// Pure parsers voor nieuwsdossier-bronnen (VRT NWS, Al Jazeera).

import { cleanText } from '../html.ts'

export interface ScrapedDossier {
  name: string
  source: string
  sourceUrl: string | null
}

function extractLinks(
  html: string,
  linkRegex: RegExp,
  source: string,
  baseUrl: string
): ScrapedDossier[] {
  const dossiers: ScrapedDossier[] = []
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    const name = cleanText(match[2])
    if (!name || name.length < 2 || name.length > 120) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const sourceUrl = href.startsWith('http') ? href : `${baseUrl}${href}`
    dossiers.push({ name, source, sourceUrl })
  }

  return dossiers
}

/**
 * VRT NWS dossierpagina: links naar /vrtnws/nl/dossiers/<slug>/ met de
 * dossiernaam als linktekst (soms in child-elementen).
 */
export function parseVrtDossiers(html: string): ScrapedDossier[] {
  return extractLinks(
    html,
    /<a[^>]*href="((?:https?:\/\/www\.vrt\.be)?\/vrtnws\/nl\/dossiers\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    'vrt',
    'https://www.vrt.be'
  )
}

/**
 * Al Jazeera sitemap: de tag-sectie bevat links naar /tag/<slug>/ met de
 * tagnaam als linktekst.
 */
export function parseAlJazeeraTags(html: string): ScrapedDossier[] {
  return extractLinks(
    html,
    /<a[^>]*href="((?:https?:\/\/www\.aljazeera\.com)?\/tag\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    'aljazeera',
    'https://www.aljazeera.com'
  )
}
