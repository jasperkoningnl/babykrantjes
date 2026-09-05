import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, sameOrigin } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { loadNewsEditor, validateNewsDraft } from '@/lib/newsEditorial'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Log opnieuw in' }, { status: 401 })
  try {
    const date = request.nextUrl.searchParams.get('date')
    if (date) return NextResponse.json(await loadNewsEditor(date), { headers: { 'Cache-Control': 'no-store' } })
    const db = getSupabaseAdmin()
    const [news, jobs] = await Promise.all([
      db.from('news_articles').select('news_date, article_id, articles!inner(editorial_status, current_revision_id)').order('news_date', { ascending: false }).limit(60),
      db.from('content_jobs').select('content_key, status, attempts, last_error').neq('status', 'completed').order('created_at', { ascending: false }).limit(60),
    ])
    if (news.error || jobs.error) throw new Error('Unavailable')
    return NextResponse.json({ news: news.data, jobs: jobs.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'De bibliotheek is nog niet beschikbaar' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  const actor = await requireAdmin(request)
  if (!actor) return NextResponse.json({ error: 'Log opnieuw in' }, { status: 401 })
  try {
    const input = await request.json()
    const db = getSupabaseAdmin()
    if (input.action === 'save') {
      const draft = validateNewsDraft(input)
      const { error } = await db.rpc('save_news_draft', {
        p_date: draft.date, p_body: draft.body, p_facts: draft.facts, p_sources: draft.sources,
        p_expected_version: draft.version, p_actor_id: actor.id,
      })
      if (error) throw error
      return NextResponse.json({ ok: true, ...await loadNewsEditor(draft.date) })
    }
    if (input.action === 'publish') {
      if (input.reviewed !== true || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000) throw new Error('Bevestig broncontrole en geef een publicatiereden')
      const { error } = await db.rpc('publish_news_draft', {
        p_article_id: input.articleId, p_expected_version: input.version,
        p_expected_current_id: input.currentRevisionId, p_actor_id: actor.id, p_reason: input.reason.trim(),
      })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || '')
    const conflict = /changed|reconcile/.test(message)
    return NextResponse.json({ error: conflict ? 'Dit artikel is intussen gewijzigd. Bewaar je tekst apart en laad het artikel opnieuw.' : 'Opslaan mislukt. Controleer tekst, datum en bronlinks.' }, { status: conflict ? 409 : 400 })
  }
}
