import 'server-only'

import { getSupabaseAdmin } from './supabase'
import { parseCalendarDate } from './contentDates'

export interface NewsJob {
  id: string
  content_key: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  lock_token: string | null
  lease_expires_at: string | null
}

export interface NewsRevisionInput {
  body: string
  facts: Record<string, unknown>
  sources: { url: string; name: string; date?: string; title?: string; retrieved_at?: string }[]
  metadata: Record<string, unknown>
  coverageTier: 'recent_week' | 'recent_month' | 'recent_year' | 'historical_on_demand'
  researchMethod: string
}

export interface PublishedNews {
  id: string
  article_id: string
  version: number
  body: string
  facts_snapshot: Record<string, unknown>
  sources_snapshot: NewsRevisionInput['sources']
  published_at: string
}

function requireDate(date: string) {
  if (!parseCalendarDate(date)) throw new Error('Ongeldige nieuwsdatum')
}

/** No callers in the customer flow yet. All mutations are single database transactions. */
export async function enqueueNewsJob(date: string): Promise<NewsJob> {
  requireDate(date)
  const { data, error } = await getSupabaseAdmin().rpc('enqueue_news_job', { p_date: date })
  if (error) throw error
  return data as NewsJob
}

export async function claimNewsJob(leaseSeconds = 300): Promise<NewsJob | null> {
  const { data, error } = await getSupabaseAdmin().rpc('claim_news_job', { p_lease_seconds: leaseSeconds })
  if (error) throw error
  return (data?.[0] as NewsJob) ?? null
}

export async function failNewsJob(jobId: string, lockToken: string, errorCode: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().rpc('fail_news_job', {
    p_job_id: jobId, p_lock_token: lockToken, p_error_code: errorCode,
  })
  if (error) throw error
  return data === true
}

export async function completeNewsJob(jobId: string, lockToken: string, revision: NewsRevisionInput): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc('complete_news_job', {
    p_job_id: jobId, p_lock_token: lockToken, p_body: revision.body,
    p_facts: revision.facts, p_sources: revision.sources, p_metadata: revision.metadata,
    p_coverage_tier: revision.coverageTier, p_research_method: revision.researchMethod,
  })
  if (error) throw error
  return data as string
}

/** Caller must authorize the editor server-side before using this internal primitive. */
export async function publishArticleRevision(input: {
  articleId: string; revisionId: string; expectedCurrentId: string | null; actorId: string; reason: string
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc('publish_article_revision', {
    p_article_id: input.articleId, p_revision_id: input.revisionId,
    p_expected_current_id: input.expectedCurrentId, p_actor_id: input.actorId, p_reason: input.reason,
  })
  if (error) throw error
  return data as string
}

export async function getPublishedNews(date: string): Promise<PublishedNews | null> {
  requireDate(date)
  const supabase = getSupabaseAdmin()
  const { data: news, error: newsError } = await supabase.from('news_articles')
    .select('article_id').eq('news_date', date).maybeSingle()
  if (newsError) throw newsError
  if (!news) return null
  const { data: article, error: articleError } = await supabase.from('articles')
    .select('current_revision_id').eq('id', news.article_id).maybeSingle()
  if (articleError) throw articleError
  if (!article?.current_revision_id) return null
  // Fetch the exact immutable revision, never simply the newest draft.
  // A newer needs_review revision must not hide the last approved publication.
  const { data, error } = await supabase.from('article_revisions')
    .select('id, article_id, version, body, facts_snapshot, sources_snapshot, published_at')
    .eq('article_id', news.article_id).eq('id', article.current_revision_id)
    .not('published_at', 'is', null).maybeSingle()
  if (error) throw error
  return data as PublishedNews | null
}
