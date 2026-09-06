import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, sameOrigin } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { amsterdamToday, parseCalendarDate } from '@/lib/contentDates'
import { gatherNewsFacts } from '@/lib/factGathering'
import { buildPrompt, SYSTEM_PROMPT, CLAUDE_MODEL } from '@/lib/prompts'
import { loadNewsEditor } from '@/lib/newsEditorial'

export const maxDuration = 120
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Verzoek niet toegestaan' }, { status: 403 })
  const actor = await requireAdmin(request)
  if (!actor) return NextResponse.json({ error: 'Log opnieuw in' }, { status: 401 })
  if (process.env.NEWS_PILOT_ENABLED !== 'true' || !process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'De generatieproef staat nog uit' }, { status: 503 })
  }
  let date: string, version: number
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 1000) throw new Error('Too large')
    const input = JSON.parse(raw)
    date = input.date; version = input.version
    if (typeof date !== 'string' || !parseCalendarDate(date) || date > amsterdamToday() || !Number.isInteger(version) || version < 0) throw new Error('Invalid input')
  } catch { return NextResponse.json({ error: 'Kies een geldige nieuwsdatum' }, { status: 400 }) }
  const db = getSupabaseAdmin()
  const generationId = randomUUID()
  try {
    const existing = await loadNewsEditor(date)
    if ((existing.article?.editorial_version || 0) !== version || existing.draft) {
      return NextResponse.json({ error: 'Er bestaat al een concept of de datum is gewijzigd. Open het bewaarde concept.' }, { status: 409 })
    }
    const { data: reserved, error } = await db.rpc('reserve_news_pilot_attempt')
    if (error) throw error
    if (!reserved) return NextResponse.json({ error: 'Het proefbudget is bereikt. Je kunt de tekst zelf blijven bewerken.' }, { status: 429 })
    // One reservation covers both researchers and the writer. No retries; failures retain it.
    const facts = await gatherNewsFacts(date, true)
    if (facts.results.length !== 2 || facts.results.some(r => r.error || !r.text.trim()) || facts.combined.length > 25000) throw new Error('Research incomplete')
    const sources = Array.from(new Map(facts.results.flatMap(r => r.sources || []).map(s => [s.url, s])).values()).slice(0, 20)
    if (!sources.length) throw new Error('Research has no citations')
    const prompt = buildPrompt('nieuws', { basisGegevens: { volledigeNaam: '[NAAM]', geboorteDatum: date }, gatheredFacts: { nieuws: facts.combined } })
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1500, temperature: 0.7, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(45000),
    })
    if (!response.ok) throw new Error('Writer unavailable')
    const result = await response.json()
    const body = (result.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    if (!body || body.length > 20000 || result.stop_reason !== 'end_turn') throw new Error('Incomplete generation')
    const metadata = { id: generationId, promptVersion: 'birth-news-v1', writer: CLAUDE_MODEL, writerUsage: result.usage,
      researchers: facts.results, reservedCents: 100, createdAt: new Date().toISOString(), humanReviewed: false }
    const { error: saveError } = await db.rpc('save_news_draft', {
      p_date: date, p_body: body, p_facts: { notes: facts.combined, generation: metadata }, p_sources: sources,
      p_expected_version: version, p_actor_id: actor.id,
    })
    // Recoverable output on a save conflict; never overwrite a concurrent editorial change.
    if (saveError) return NextResponse.json({ saved: false, body, facts: facts.combined, sources, generationId,
      message: 'Artikel gemaakt, maar niet bewaard omdat de datum gewijzigd is. Kopieer deze tekst voordat je opnieuw laadt.' }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ saved: true, ...await loadNewsEditor(date), generationId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Onderzoek of schrijven is niet volledig gelukt. Er is niets gepubliceerd. De poging blijft meetellen voor het proefbudget.' }, { status: 503 })
  }
}
