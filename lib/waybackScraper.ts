// lib/waybackScraper.ts
// @version 1.0.0
// Gedeelde scraping-logica voor Wayback Machine nieuws
// Geëxtraheerd uit app/api/news/wayback/route.ts zodat discovery scripts
// en cron jobs dezelfde functies kunnen hergebruiken.

import { fetchWithRetry } from '@/lib/waybackFetch'
import type { WaybackHeadline } from '@/lib/waybackCache'

export type Headline = WaybackHeadline

export interface WaybackSnapshot {
  timestamp: string
  url: string
  status: string
  mimeType: string
  source: string
}

// CDX API response format: [urlkey, timestamp, original, mimetype, statuscode, digest, length]
type CDXRecord = [string, string, string, string, string, string, string]

export const MIN_HEADLINES = 5
export const CDX_LIMIT = 20

export const NEWS_SOURCES = {
  primary: ['www.nos.nl'],
  fallback: ['www.nu.nl', 'nos.nl']
}

// =============================================================================
// CDX / snapshot utilities
// =============================================================================

/**
 * Zoekt de beste snapshot van een bron op een datum via CDX API.
 * Probeert zowel HTTP als HTTPS; prefereert snapshots in piekuur (12-20).
 */
export async function findSnapshot(date: string, source: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`
  const protocols = ['http', 'https']

  let allSnapshots: Array<{
    timestamp: string
    url: string
    status: string
    mimeType: string
    hour: number
    score: number
  }> = []

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const domain = source.replace(/^www\./, '')
    const fullUrl = `${prefix}${domain}/`
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${fullUrl}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=${CDX_LIMIT}`

    try {
      const response = await fetchWithRetry(cdxUrl, {
        headers: { 'User-Agent': 'Babykrant/1.0 (educational project)' }
      })

      if (!response.ok) continue

      const data = await response.json() as CDXRecord[]
      if (data.length < 2) continue

      const snapshots = data.slice(1).map(record => {
        const [, timestamp, original, mimetype, statuscode] = record
        const hour = parseInt(timestamp.substring(8, 10))
        let score = 1
        if (hour >= 12 && hour <= 20) score = 10
        else if (hour >= 8 && hour < 12) score = 5

        return { timestamp, url: original, status: statuscode, mimeType: mimetype, hour, score }
      })

      allSnapshots.push(...snapshots)
    } catch {
      continue
    }
  }

  if (allSnapshots.length === 0) return null

  allSnapshots.sort((a, b) => b.score - a.score)
  const best = allSnapshots[0]

  return {
    timestamp: best.timestamp,
    url: best.url,
    status: best.status,
    mimeType: best.mimeType,
    source
  }
}

/**
 * Haalt HTML op van een Wayback snapshot. Probeert HTTPS dan HTTP.
 */
export async function fetchSnapshotContent(timestamp: string, source: string): Promise<string | null> {
  const domain = source.replace(/^www\./, '')
  const protocols = ['https', 'http']

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${prefix}${domain}/`

    try {
      const response = await fetchWithRetry(waybackUrl, {
        headers: {
          'User-Agent': 'Babykrant/1.0 (educational project)',
          'Accept': 'text/html'
        }
      })

      if (response.ok) return await response.text()
    } catch {
      continue
    }
  }

  return null
}

/**
 * Formatteert een Wayback URL voor weergave.
 */
export function getWaybackUrl(timestamp: string, source: string): string {
  const protocol = source.startsWith('www.') ? 'https://www.' : 'https://'
  const domain = source.replace(/^www\./, '')
  return `https://web.archive.org/web/${timestamp}/${protocol}${domain}/`
}

// =============================================================================
// HTML parsers
// =============================================================================

/**
 * Kiest de juiste parser op basis van de bron.
 */
export function parseHeadlines(html: string, source: string): Headline[] {
  if (source === 'www.nu.nl') return parseNuNlHeadlines(html, source)
  if (source === 'www.nos.nl' || source === 'nos.nl') return parseNosNlHeadlines(html, source)

  // Onbekende bron: probeer beide en kies de beste
  const nu = parseNuNlHeadlines(html, source)
  const nos = parseNosNlHeadlines(html, source)
  return nu.length > nos.length ? nu : nos
}

function parseNuNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()

  const extractCategory = (url: string): string | null => {
    const match = url.match(/nu\.nl\/([a-z-]+)\//)
    if (match && match[1]) {
      const cat = match[1]
      if (['advertorial', 'nushop', 'tag', 'zoeken'].includes(cat)) return null
      return cat.charAt(0).toUpperCase() + cat.slice(1)
    }
    return null
  }

  const addHeadline = (title: string, url = '', category: string | null = null, time: string | null = null) => {
    const cleanTitle = decodeHtmlEntities(title.trim())
      .replace(/^(Video|Podcast|Liveblog[^:]*:?)\s*/i, '')
      .trim()

    if (!cleanTitle || cleanTitle.length <= 10 || seen.has(cleanTitle.toLowerCase()) || isNoiseHeadline(cleanTitle)) return

    seen.add(cleanTitle.toLowerCase())

    let cleanUrl = url
    if (url) {
      const m = url.match(/\/web\/\d+\/(.+)/)
      cleanUrl = m ? 'https://' + m[1].replace(/^https?:\/\//, '') : url
    }

    headlines.push({ title: cleanTitle, url: cleanUrl, category, time, source })
  }

  let match

  const modernTitleAttr = /<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi
  while ((match = modernTitleAttr.exec(html)) !== null) addHeadline(match[1])

  const modernSpanContent = /<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)\s*<\/span>/gi
  while ((match = modernSpanContent.exec(html)) !== null) addHeadline(match[1])

  const modernLink = /<a[^>]*href="([^"]*\/nu\.nl\/[^"]+\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)/gi
  while ((match = modernLink.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const legacySpanTitle = /<span[^>]*class="title"[^>]*>([^<]+)<\/span>/gi
  while ((match = legacySpanTitle.exec(html)) !== null) addHeadline(match[1])

  const legacyH3Link = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi
  while ((match = legacyH3Link.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const legacyH3Content = /<h3[^>]*>([^<]+)<\/h3>/gi
  while ((match = legacyH3Content.exec(html)) !== null) addHeadline(match[1])

  const fallbackH2 = /<h2[^>]*>\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h2>/gi
  while ((match = fallbackH2.exec(html)) !== null) addHeadline(match[1])

  const fallbackArticleLink = /<a[^>]*class="[^"]*article[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = fallbackArticleLink.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const fallbackDivTitle = /<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/gi
  while ((match = fallbackDivTitle.exec(html)) !== null) addHeadline(match[1])

  return headlines
}

function parseNosNlHeadlines(html: string, source: string): Headline[] {
  const headlines: Headline[] = []
  const seen = new Set<string>()

  const extractCategory = (url: string): string | null => {
    const match = url.match(/nos\.nl\/(nieuws\/)?([a-z-]+)\//)
    if (match && match[2]) {
      const cat = match[2]
      if (['artikel', 'video', 'audio', 'uitzending'].includes(cat)) return null
      return cat.charAt(0).toUpperCase() + cat.slice(1)
    }
    return null
  }

  const cleanWaybackUrl = (url: string): string => {
    const match = url.match(/\/web\/\d+\/(.+)/)
    if (match) return 'https://' + match[1].replace(/^https?:\/\//, '')
    return url
  }

  const addHeadline = (title: string, url = '', category: string | null = null, time: string | null = null) => {
    const cleanTitle = decodeHtmlEntities(title.trim())
    if (!cleanTitle || cleanTitle.length <= 10 || seen.has(cleanTitle.toLowerCase()) || isNoiseHeadline(cleanTitle)) return
    seen.add(cleanTitle.toLowerCase())
    headlines.push({ title: cleanTitle, url: url ? cleanWaybackUrl(url) : '', category, time, source })
  }

  let match

  const topstoryH1Pattern = /<h1[^>]*class="[^"]*topstory_mainarticle_title[^"]*"[^>]*>([^<]+)<\/h1>/gi
  while ((match = topstoryH1Pattern.exec(html)) !== null) addHeadline(match[1], '', 'Top Story')

  const topstoryH3Pattern = /<h3[^>]*class="[^"]*topstory__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi
  while ((match = topstoryH3Pattern.exec(html)) !== null) {
    const cleanText = match[1].replace(/<[^>]+>/g, '').trim()
    if (cleanText) addHeadline(cleanText, '', 'Top Story')
  }

  const topStoryPattern = /<div[^>]*class="[^"]*top-story[^"]*"[^>]*>[\s\S]*?<strong>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/strong>/gi
  while ((match = topStoryPattern.exec(html)) !== null) addHeadline(match[2], match[1], 'Top Story')

  const subtopstoriesPattern = /<ul[^>]*data-testid="sub-topstories"[^>]*>([\s\S]*?)<\/ul>/gi
  while ((match = subtopstoriesPattern.exec(html)) !== null) {
    const section = match[1]
    const h2Pattern = /<h2[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi
    let h2Match
    while ((h2Match = h2Pattern.exec(section)) !== null) {
      const cleanText = h2Match[1].replace(/<[^>]+>/g, '').trim()
      if (cleanText) addHeadline(cleanText, '', 'Top Story')
    }
  }

  const cardContentPattern = /<a[^>]*class="[^"]*"[^>]*data-testid="card-content-inside"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi
  while ((match = cardContentPattern.exec(html)) !== null) {
    const cleanText = match[2].replace(/<[^>]+>/g, '').trim()
    if (cleanText) addHeadline(cleanText, match[1], 'Top Story')
  }

  const highlightedCardPattern = /<a[^>]*data-testid="highlightedcard"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi
  while ((match = highlightedCardPattern.exec(html)) !== null) {
    const cleanText = match[2].replace(/<[^>]+>/g, '').trim()
    if (cleanText) addHeadline(cleanText, match[1], 'Top Story')
  }

  const featuredPattern = /<li[^>]*class="[^"]*big[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = featuredPattern.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const categoryPattern = /<li[^>]*class="[^"]*click[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi
  while ((match = categoryPattern.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const latestPattern = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="time"[^>]*>(\d{1,2}:\d{2})<\/span>[\s\S]*?<strong>([^<]+)<\/strong>/gi
  while ((match = latestPattern.exec(html)) !== null) {
    const title = match[4] || match[2]
    addHeadline(title, match[1], extractCategory(match[1]), match[3])
  }

  const laatstePattern = /<li[^>]*class="[^"]*list-latest__item[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*link-hover[^"]*"[^>]*>([^<]+)<\/span>/gi
  while ((match = laatstePattern.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const legacyH3Link = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi
  while ((match = legacyH3Link.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const legacyH3Content = /<h3[^>]*>([^<]+)<\/h3>/gi
  while ((match = legacyH3Content.exec(html)) !== null) addHeadline(match[1])

  const legacyH2 = /<h2[^>]*>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h2>/gi
  while ((match = legacyH2.exec(html)) !== null) addHeadline(match[2], match[1] || '', extractCategory(match[1] || ''))

  const fallbackTitle = /<(?:div|span)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/(?:div|span)>/gi
  while ((match = fallbackTitle.exec(html)) !== null) addHeadline(match[1])

  const fallbackStrongLink = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/gi
  while ((match = fallbackStrongLink.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const fallbackNosLink = /<a[^>]*href="([^"]*nos\.nl\/artikel\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
  while ((match = fallbackNosLink.exec(html)) !== null) addHeadline(match[2], match[1], extractCategory(match[1]))

  const genericH2LinkPattern = /<a[^>]*href="([^"]*\/(?:artikel|video|liveblog)\/[^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi
  while ((match = genericH2LinkPattern.exec(html)) !== null) {
    const cleanText = match[2].replace(/<[^>]+>/g, '').trim()
    if (cleanText) addHeadline(cleanText, match[1], extractCategory(match[1]))
  }

  return headlines
}

// =============================================================================
// Hulpfuncties
// =============================================================================

/**
 * Filtert navigatie-elementen en ruis eruit.
 */
export function isNoiseHeadline(title: string): boolean {
  const lowerTitle = title.toLowerCase()

  const exactNoisePatterns = [
    'live kanalen', 'archive team', 'category_news', 'category_sport',
    'mobiele apps', 'volg de nos', 'laatste nieuws', 'laatste journaal',
    'laatste achtuurjournaal', 'nos jeugdjournaal', 'meest bekeken video\'s',
    'tip van de redactie', 'uitgelicht nieuws', 'wetenschapsagenda',
    'media uploaden', 'uit en thuis', 'nieuwsvideo\'s', 'media en cultuur',
    'praat mee op nujij', 'meest gelezen', 'voor jou geselecteerd',
    'lezersfoto\'s', 'tip de redactie', 'lezersbijdragen', 'uitgelichte video\'s',
    'van onze adverteerders', 'nieuws in 60 seconden', 'het nieuws in 60 seconden',
    'nos headlines', 'alexa crawls', 'video\'s en audio',
    'nos informatie', 'live bij de nos', 'je hoeft niks te missen',
    'internet archive', 'live web proxy crawls', 'palestine web', 'archive team: urls',
    'val regime-assad', 'geweld midden-oosten', 'stikstofcrisis', 'van biden naar trump',
    'het klimaat verandert', 'oorlog in oekraïne', 'oorlog in gaza', 'gronings gas',
    'kabinet-schoof beëdigd', 'verkiezingscampagne vs'
  ]

  if (exactNoisePatterns.includes(lowerTitle)) return true

  if (lowerTitle.match(/^bestel|^ontvang|^stel in \d+ stappen|^bekijk hier de folder|^profiteer nu|^alleen deze week|^nu minimaal|^speel mee met/)) return true
  if (lowerTitle.match(/van \d+[,.]?\d* (euro )?voor \d+[,.]?\d* euro/)) return true
  if (lowerTitle.match(/^(coronavirus|nushop|uitzendingen?)$/)) return true
  if (lowerTitle.includes('archive team') && lowerTitle.includes('snapshots')) return true
  if (lowerTitle.match(/\d+\s*(foto'?s|fotos|beeld)/)) return true

  return false
}

/**
 * Decodeert HTML entities naar unicode.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&iuml;/g, 'ï')
    .replace(/&euml;/g, 'ë')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&Iuml;/g, 'Ï')
    .replace(/&Euml;/g, 'Ë')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// High-level scrape functie (voor hergebruik in cron en discovery scripts)
// =============================================================================

export interface ScrapeNewsResult {
  headlines: Headline[]
  sources: string[]
  timestamp: string | null
}

/**
 * Scrapt nieuws voor een datum: probeert alle bronnen en combineert resultaten.
 * Dit is de volledige multi-source strategie die ook in de API route wordt gebruikt.
 */
export async function scrapeNewsForDate(date: string): Promise<ScrapeNewsResult> {
  const allHeadlines: Headline[] = []
  const usedSources: string[] = []
  let primaryTimestamp: string | null = null

  const requestYear = parseInt(date.split('-')[0])
  const shouldCombineSources = requestYear < 2013

  // Primaire bron
  for (const source of NEWS_SOURCES.primary) {
    const snapshot = await findSnapshot(date, source)
    if (!snapshot) continue

    const html = await fetchSnapshotContent(snapshot.timestamp, source)
    if (!html) continue

    const headlines = parseHeadlines(html, source)
    if (headlines.length === 0) continue

    allHeadlines.push(...headlines)
    usedSources.push(source)
    primaryTimestamp = snapshot.timestamp

    if (!shouldCombineSources) {
      return { headlines: allHeadlines, sources: usedSources, timestamp: primaryTimestamp }
    }
    break
  }

  // Fallback / combinatie voor pre-2013
  for (const source of NEWS_SOURCES.fallback) {
    if (source === 'www.nu.nl' && usedSources.includes('www.nos.nl') && !shouldCombineSources) continue
    if (source === 'nos.nl' && usedSources.includes('www.nos.nl')) continue

    const snapshot = await findSnapshot(date, source)
    if (!snapshot) continue

    const html = await fetchSnapshotContent(snapshot.timestamp, source)
    if (!html) continue

    const headlines = parseHeadlines(html, source)
    if (headlines.length === 0) continue

    allHeadlines.push(...headlines)
    usedSources.push(source)
    if (!primaryTimestamp) primaryTimestamp = snapshot.timestamp
  }

  return { headlines: allHeadlines, sources: usedSources, timestamp: primaryTimestamp }
}
