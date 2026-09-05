import 'server-only'
import { getSupabaseAdmin } from './supabase'
import { parseCalendarDate } from './contentDates'

export function validateNewsDraft(input: any) {
  if (!input || !parseCalendarDate(input.date) || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 20000) throw new Error('Vul datum en artikeltekst in')
  if (typeof input.facts !== 'string' || input.facts.length > 20000) throw new Error('Feiten zijn te lang')
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 20) throw new Error('Voeg minimaal één bron toe')
  const sources = input.sources.map((source: any) => {
    if (typeof source?.name !== 'string' || !source.name.trim() || source.name.length > 200 || typeof source.url !== 'string' || source.url.length > 2000) throw new Error('Ongeldige bron')
    const url = new URL(source.url)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Gebruik een gewone bronlink')
    return { name: source.name.trim(), url: url.toString() }
  })
  if (!Number.isInteger(input.version) || input.version < 0) throw new Error('Ongeldige conceptversie')
  return { date: input.date as string, body: input.body.trim(), facts: { notes: input.facts }, sources, version: input.version as number }
}

export async function loadNewsEditor(date: string) {
  if (!parseCalendarDate(date)) throw new Error('Ongeldige datum')
  const db = getSupabaseAdmin()
  const { data: news, error } = await db.from('news_articles').select('article_id').eq('news_date', date).maybeSingle()
  if (error) throw error
  if (!news) return { date, article: null, draft: null, revisions: [], publications: [] }
  const results = await Promise.all([
    db.from('articles').select('id, current_revision_id, editorial_status, editorial_version').eq('id', news.article_id).single(),
    db.from('article_drafts').select('*').eq('article_id', news.article_id).maybeSingle(),
    db.from('article_revisions').select('id, version, body, facts_snapshot, sources_snapshot, created_at, published_at').eq('article_id', news.article_id).order('version', { ascending: false }).limit(20),
    db.from('article_publications').select('revision_id, previous_revision_id, reason, created_at').eq('article_id', news.article_id).order('created_at', { ascending: false }).limit(20),
  ])
  for (const result of results) if (result.error) throw result.error
  return { date, article: results[0].data, draft: results[1].data, revisions: results[2].data, publications: results[3].data }
}
