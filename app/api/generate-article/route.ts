import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationResponse, ArticleSection } from '@/lib/articleTypes'
import { ARTICLE_SECTIONS, CLAUDE_PRICING } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/prompts'
import { callClaude } from '@/lib/claude'
import { gatherNewsFacts, gatherCultuurFacts } from '@/lib/factGathering'
import { checkRateLimit, reserveDailyCost, settleDailyCost } from '@/lib/rateLimit'
import { findPaperSession } from '@/lib/paperSession'
import { loadPaperState } from '@/lib/paperState'
import { getSupabaseAdmin } from '@/lib/supabase'

export const maxDuration = 120
const RESERVED_COST = 0.03

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) + ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Geen geldige krantsessie' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const section = String(body?.section || '') as ArticleSection
  if (!Object.prototype.hasOwnProperty.call(ARTICLE_SECTIONS, section)) return NextResponse.json({ success: false, error: 'Ongeldige sectie' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ success: false, error: 'API niet geconfigureerd' }, { status: 503 })

  const rateLimit = await checkRateLimit(request, 'article')
  if (!rateLimit.allowed) return NextResponse.json({ success: false, error: 'Generatie tijdelijk niet beschikbaar', remainingRequests: 0 }, { status: rateLimit.unavailable ? 503 : 429 })
  const reservation = await reserveDailyCost(RESERVED_COST)
  if (!reservation.ok) return NextResponse.json({ success: false, error: reservation.unavailable ? 'Generatie tijdelijk niet beschikbaar' : 'Dagbudget bereikt' }, { status: reservation.unavailable ? 503 : 429 })

  try {
    const data: any = await loadPaperState(session.paperId)
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 64 * 1024) {
      await settleDailyCost(RESERVED_COST, 0)
      return NextResponse.json({ success: false, error: 'Invoer is te groot' }, { status: 413 })
    }
    if (section === 'nieuws' || section === 'cultuur') {
      const date = data.basisGegevens?.geboorteDatum || ''
      const facts = section === 'nieuws' ? await gatherNewsFacts(date) : await gatherCultuurFacts(date)
      data.gatheredFacts = { ...data.gatheredFacts, [section]: facts.combined }
    }
    const result = await callClaude(buildPrompt(section, data), SYSTEM_PROMPT)
    const text = result.text.trim()
    const cost = calculateCost(result.tokensUsed.input, result.tokensUsed.output)
    await settleDailyCost(RESERVED_COST, cost)

    const edits = { ...(data.generatedArticles || {}), ...(data.manualEdits || {}), [section]: text }
    const { error } = await getSupabaseAdmin().from('generated_papers').update({ manual_edits: edits }).eq('id', session.paperId)
    if (error) throw error
    return NextResponse.json({
      success: true,
      section,
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      tokensUsed: result.tokensUsed.input + result.tokensUsed.output,
      cost,
      remainingRequests: rateLimit.remaining,
    } as ArticleGenerationResponse)
  } catch (error) {
    console.error('[GenerateArticle] Error:', error)
    return NextResponse.json({ success: false, error: 'Generatie mislukt' }, { status: 500 })
  }
}
