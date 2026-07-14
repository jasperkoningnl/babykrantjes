// supabase/functions/scrape-google-news/index.ts
// Job 4: Google News NL topics (dagelijks, 07:00)
// Bron: Google News RSS feeds (nl-NL)
// Schrijft naar: daily_google_news
//
// Optionele query parameters:
//   ?date=YYYY-MM-DD  — datum waaronder de items worden opgeslagen (default vandaag)

import { runJob, SupabaseClient } from '../_shared/db.ts'
import { fetchWithRetry, sleep } from '../_shared/fetch.ts'
import { todayISO } from '../_shared/dates.ts'
import { parseGoogleNewsRss } from '../_shared/parsers/googleNews.ts'

const SOURCE_NAME = 'google-news-nl'

const FEEDS: Array<{ category: string; url: string }> = [
  { category: 'TOP', url: 'https://news.google.com/rss?hl=nl&gl=NL&ceid=NL:nl' },
  { category: 'WORLD', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=nl&gl=NL&ceid=NL:nl' },
  { category: 'NATION', url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=nl&gl=NL&ceid=NL:nl' },
]

const MAX_ITEMS_PER_FEED = 20

async function scrape(supabase: SupabaseClient, date: string): Promise<{ inserted: number; details: unknown }> {
  let inserted = 0
  const perFeed: Record<string, number> = {}
  const errors: string[] = []

  for (const feed of FEEDS) {
    try {
      const response = await fetchWithRetry(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BabykrantBot/1.0)' },
      })
      if (!response.ok) {
        errors.push(`${feed.category}: HTTP ${response.status}`)
        continue
      }

      const xml = await response.text()
      const items = parseGoogleNewsRss(xml).slice(0, MAX_ITEMS_PER_FEED)
      perFeed[feed.category] = items.length

      if (items.length === 0) {
        errors.push(`${feed.category}: 0 items geparseerd`)
        continue
      }

      const rows = items.map((item) => ({
        date,
        topic_category: feed.category,
        title: item.title,
        source_name: item.sourceName,
        published_at: item.publishedAt,
      }))

      const { error } = await supabase
        .from('daily_google_news')
        .upsert(rows, { onConflict: 'date,topic_category,title' })

      if (error) {
        errors.push(`${feed.category}: ${error.message}`)
      } else {
        inserted += rows.length
      }
    } catch (err) {
      errors.push(`${feed.category}: ${err instanceof Error ? err.message : String(err)}`)
    }

    await sleep(1000)
  }

  if (inserted === 0 && errors.length > 0) {
    throw new Error(`Alle feeds faalden: ${errors.join('; ')}`)
  }

  return { inserted, details: { date, perFeed, errors } }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || todayISO()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: 'Ongeldige datum, gebruik YYYY-MM-DD' }, { status: 400 })
  }

  return runJob(SOURCE_NAME, (supabase) => scrape(supabase, date))
})
