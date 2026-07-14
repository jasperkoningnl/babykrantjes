// supabase/functions/_shared/parsers/googleNews.ts
// Pure parser voor Google News RSS 2.0 — geen Deno- of Node-API's,
// zodat dezelfde code in de Edge Function én in vitest draait.

import { decodeHtmlEntities } from '../html.ts'

export interface GoogleNewsItem {
  title: string
  sourceName: string | null
  publishedAt: string | null
}

/**
 * Parse Google News RSS 2.0 XML.
 * Item-structuur:
 *   <item>
 *     <title>Kop van het artikel - Bron</title>
 *     <pubDate>Mon, 13 Jul 2026 06:12:00 GMT</pubDate>
 *     <source url="https://nos.nl">NOS</source>
 *   </item>
 */
export function parseGoogleNewsRss(xml: string): GoogleNewsItem[] {
  const items: GoogleNewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g

  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    if (!titleMatch) continue
    let title = decodeHtmlEntities(titleMatch[1].trim())

    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)
    const sourceName = sourceMatch ? decodeHtmlEntities(sourceMatch[1].trim()) : null

    // Google News plakt " - Bron" achter de titel; strip dat als het overeenkomt
    if (sourceName && title.endsWith(` - ${sourceName}`)) {
      title = title.slice(0, -(` - ${sourceName}`.length)).trim()
    }

    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
    let publishedAt: string | null = null
    if (pubDateMatch) {
      const parsed = new Date(pubDateMatch[1].trim())
      if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString()
    }

    if (title) items.push({ title, sourceName, publishedAt })
  }

  return items
}
