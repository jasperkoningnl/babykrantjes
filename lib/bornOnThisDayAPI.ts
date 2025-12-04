// lib/bornOnThisDayAPI.ts
// @version 1.0.1
// API voor het ophalen van personen geboren op een specifieke datum
// Bron: Wikipedia NL

export interface BornPerson {
  name: string
  year: number
  description: string
  wikipediaUrl?: string
}

/**
 * Haalt bekende personen op die geboren zijn op een specifieke datum
 * @param dateStr - Datum in YYYY-MM-DD formaat
 */
export async function getBornOnThisDay(
  dateStr: string
): Promise<BornPerson[]> {
  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ]

  // Parse de datum string
  const date = new Date(dateStr)
  const day = date.getDate()
  const month = date.getMonth() // 0-indexed

  const pageTitle = `${day}_${monthNames[month]}`

  try {
    const apiUrl = `https://nl.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'BabykrantjesGenerator/1.0' }
    })

    if (!response.ok) {
      console.error(`HTTP error fetching born on this day: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (data.error) {
      console.error('Wikipedia API error:', data.error)
      return []
    }

    const html = data.parse?.text?.['*'] || ''
    const persons = parseBornPersons(html)

    return persons
  } catch (error) {
    console.error('Error fetching born on this day:', error)
    return []
  }
}

/**
 * Parset de geboren personen uit de Wikipedia HTML
 */
function parseBornPersons(html: string): BornPerson[] {
  const persons: BornPerson[] = []

  try {
    // Zoek de sectie "Geboren"
    const geborenMatch = html.match(
      /<h[23][^>]*id="Geboren"[^>]*>.*?<\/h[23]>([\s\S]*?)(?=<h[23]|$)/i
    )

    if (!geborenMatch) {
      console.log('No "Geboren" section found')
      return []
    }

    const geborenHtml = geborenMatch[1]

    // Parse list items
    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match

    while ((match = listItemRegex.exec(geborenHtml)) !== null && persons.length < 15) {
      const item = match[1]

      // Zoek naar jaar (4 cijfers aan het begin)
      const yearMatch = item.match(/(\d{4})/)
      if (!yearMatch) continue

      const year = parseInt(yearMatch[1], 10)

      // Zoek naar de persoonsnaam (eerste link na het jaar)
      const linkMatch = item.match(
        /<a\s+href="([^"]*)"[^>]*(?:\s+title="([^"]*)")?[^>]*>([^<]+)<\/a>/
      )

      if (!linkMatch) continue

      const href = linkMatch[1]
      const title = linkMatch[2] || linkMatch[3]
      const linkText = linkMatch[3]

      // Skip als het een jaar-link is
      if (/^\d{4}$/.test(linkText)) continue

      // Haal beschrijving uit de rest van de tekst
      let description = item
        .replace(/<sup[^>]*>.*?<\/sup>/g, '') // Verwijder referenties
        .replace(/<[^>]+>/g, ' ') // Strip HTML
        .replace(/\s+/g, ' ')
        .replace(/^\s*\d{4}\s*[-–—]\s*/, '') // Verwijder jaar
        .trim()

      // Verwijder de naam zelf uit de beschrijving
      description = description.replace(linkText, '').replace(/^[\s,\-–—]+/, '').trim()

      // Beperk beschrijving
      if (description.length > 100) {
        description = description.substring(0, 100).trim() + '...'
      }

      const wikipediaUrl = href.startsWith('/wiki/')
        ? `https://nl.wikipedia.org${href}`
        : undefined

      persons.push({
        name: decodeHtmlEntities(linkText),
        year,
        description: decodeHtmlEntities(description),
        wikipediaUrl
      })
    }
  } catch (error) {
    console.error('Error parsing born persons:', error)
  }

  return persons
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
}