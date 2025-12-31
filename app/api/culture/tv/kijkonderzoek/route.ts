// app/api/culture/tv/kijkonderzoek/route.ts
// @version 1.0.0
// LIVE scraper voor kijkonderzoek.nl (laatste week tot 1 week geleden)
// Haalt Top 25 meest bekeken programma's op

import { NextRequest, NextResponse } from 'next/server'

const API_VERSION = '1.0.0'

export interface KijkonderzoekProgram {
  title: string
  episodeTitle: string | null
  description: string | null  // Altijd null - kijkonderzoek.nl heeft geen descriptions
  broadcaster: string | null
  channel: string | null
  imageUrl: string | null      // Altijd null - kijkonderzoek.nl heeft geen images
  sourceUrl: string | null
  time: string | null           // Uitzendtijd (HH:MM)
  ranking: number               // Top 25 positie (1-25)
  viewerCount: number | null    // Gemiddeld aantal kijkers
  viewerShare: number | null    // Marktaandeel percentage
}

export interface KijkonderzoekResult {
  programs: KijkonderzoekProgram[]
  date: string
  totalFound: number
  source: string
  sourceUrl: string
  apiVersion: string
  error?: string
}

/**
 * Berekent het bestand pad voor kijkonderzoek.nl op basis van datum
 * De site gebruikt file,d1-{daysAgo}-0-p waarbij:
 * - 0 = vandaag
 * - 1 = gisteren
 * - 2 = eergisteren
 * - etc.
 */
function calculateDaysAgo(dateString: string): number {
  const targetDate = new Date(dateString)
  const today = new Date()

  // Zet beide datums op midnight voor correcte vergelijking
  targetDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Parseert de Top 25 tabel van kijkonderzoek.nl
 * Structuur van voorpagina Top 25:
 * <td class='kc_cdcb'>1</td>                           // Positie
 * <td class='kc_cdtitle'>PROGRAMMA TITEL</td>         // Titel
 * <td class='kc_cdstation'>RTL 4</td>                 // Zender
 * <td class='kc_cdrt0'>2.567.000</td>                 // Gemiddeld
 * <td class='kc_cdrt0'>3.599.000</td>                 // Totaal
 */
function parseKijkonderzoekTop25(html: string, dateString: string): KijkonderzoekProgram[] {
  const programs: KijkonderzoekProgram[] = []

  try {
    // Regex voor voorpagina Top 25 structuur
    const rowRegex = /<tr>\s*<td class=['"]kc_cdcb['"]>(\d+)<\/td>\s*<td class=['"]kc_cdtitle['"]>([^<]+)<\/td>\s*<td class=['"]kc_cdstation['"]>([^<]+)<\/td>\s*<td class=['"]kc_cdrt0['"]>([\d.]+)<\/td>\s*<td class=['"]kc_cdrt0['"]>([\d.]+)<\/td>\s*<\/tr>/gi

    let match
    while ((match = rowRegex.exec(html)) !== null) {
      const [
        ,
        positionStr,
        title,
        channel,
        gemiddeldStr,
        totaalStr
      ] = match

      const position = parseInt(positionStr, 10)
      const viewerCount = parseViewerCount(gemiddeldStr)
      const totalViewers = parseViewerCount(totaalStr)

      // Skip als we geen valide positie hebben (1-25)
      if (position < 1 || position > 25) continue

      programs.push({
        title: cleanTitle(title),
        episodeTitle: null,  // kijkonderzoek.nl heeft geen episode info
        description: null,   // kijkonderzoek.nl heeft geen descriptions
        broadcaster: null,   // kijkonderzoek.nl toont alleen zender
        channel: channel.trim(),
        imageUrl: null,      // kijkonderzoek.nl heeft geen images
        sourceUrl: null,
        time: null,          // Voorpagina heeft geen tijdsinformatie
        ranking: position,
        viewerCount,
        viewerShare: null    // Voorpagina heeft geen marktaandeel data
      })
    }

    console.log(`[Kijkonderzoek] Parsed ${programs.length} programs from Top 25`)

  } catch (error) {
    console.error('[Kijkonderzoek] Parse error:', error)
  }

  return programs
}

/**
 * Parseert kijkersaantallen (bijv. "2.567.000" -> 2567000)
 */
function parseViewerCount(str: string): number | null {
  try {
    const cleaned = str.replace(/\./g, '').trim()
    return parseInt(cleaned, 10)
  } catch {
    return null
  }
}

/**
 * Parseert percentages (bijv. "15,4" -> 15.4)
 */
function parsePercentage(str: string): number | null {
  try {
    const cleaned = str.replace(/,/g, '.').trim()
    return parseFloat(cleaned)
  } catch {
    return null
  }
}

/**
 * Ruimt titels op
 */
function cleanTitle(title: string): string {
  return title
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
}

/**
 * Valideert of de datum binnen het beschikbare bereik valt
 * kijkonderzoek.nl heeft data van vandaag tot ~7 dagen geleden
 */
function isDateInRange(dateString: string): { valid: boolean; daysAgo: number; error?: string } {
  const daysAgo = calculateDaysAgo(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(dateString)
  targetDate.setHours(0, 0, 0, 0)

  // Te ver in de toekomst
  if (daysAgo < 0) {
    return {
      valid: false,
      daysAgo,
      error: 'Date is in the future'
    }
  }

  // Te ver in het verleden (kijkonderzoek.nl heeft max ~7 dagen)
  if (daysAgo > 7) {
    return {
      valid: false,
      daysAgo,
      error: `Date is too old. kijkonderzoek.nl has data up to ~7 days ago. Requested date is ${daysAgo} days ago.`
    }
  }

  return { valid: true, daysAgo }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date') // YYYY-MM-DD format

  console.log(`[Kijkonderzoek API v${API_VERSION}] Request for date: ${dateParam}`)

  if (!dateParam) {
    return NextResponse.json({
      programs: [],
      date: '',
      totalFound: 0,
      source: 'kijkonderzoek.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'Missing required parameter: date (YYYY-MM-DD)'
    } as KijkonderzoekResult, { status: 400 })
  }

  // Valideer datum formaat
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateParam)) {
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'kijkonderzoek.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: 'Invalid date format. Use YYYY-MM-DD'
    } as KijkonderzoekResult, { status: 400 })
  }

  // Valideer datum bereik
  const rangeCheck = isDateInRange(dateParam)
  if (!rangeCheck.valid) {
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'kijkonderzoek.nl',
      sourceUrl: '',
      apiVersion: API_VERSION,
      error: rangeCheck.error
    } as KijkonderzoekResult, { status: 400 })
  }

  const daysAgo = rangeCheck.daysAgo
  const fileParam = `d1-${daysAgo}-0-p`
  const url = `https://kijkonderzoek.nl/component/kijkcijfers/file,${fileParam}`

  console.log(`[Kijkonderzoek] Fetching: ${url} (${daysAgo} days ago)`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      next: { revalidate: 86400 } // Cache 1 dag (data kan nog veranderen door uitgesteld kijken)
    })

    if (!response.ok) {
      console.error(`[Kijkonderzoek] HTTP ${response.status}`)
      return NextResponse.json({
        programs: [],
        date: dateParam,
        totalFound: 0,
        source: 'kijkonderzoek.nl',
        sourceUrl: url,
        apiVersion: API_VERSION,
        error: `No data found for ${dateParam} (HTTP ${response.status})`
      } as KijkonderzoekResult)
    }

    const html = await response.text()
    const programs = parseKijkonderzoekTop25(html, dateParam)

    console.log(`[Kijkonderzoek] Found ${programs.length} programs for ${dateParam}`)

    return NextResponse.json({
      programs,
      date: dateParam,
      totalFound: programs.length,
      source: 'kijkonderzoek.nl',
      sourceUrl: url,
      apiVersion: API_VERSION
    } as KijkonderzoekResult)

  } catch (error) {
    console.error('[Kijkonderzoek] Error:', error)
    return NextResponse.json({
      programs: [],
      date: dateParam,
      totalFound: 0,
      source: 'kijkonderzoek.nl',
      sourceUrl: url,
      apiVersion: API_VERSION,
      error: error instanceof Error ? error.message : 'Failed to fetch TV data'
    } as KijkonderzoekResult, { status: 500 })
  }
}
