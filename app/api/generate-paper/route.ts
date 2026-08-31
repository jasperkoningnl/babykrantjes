import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_PRICING } from '@/lib/articleTypes'
import type { ArticleSection } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildFullPaperPrompt, PAPER_TOOL } from '@/lib/prompts'
import { callClaudeStructured } from '@/lib/claude'
import { gatherNewsFacts, gatherCultuurFacts } from '@/lib/factGathering'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checkRateLimit, reserveDailyCost, settleDailyCost } from '@/lib/rateLimit'
import { findPaperSession } from '@/lib/paperSession'
import { loadPaperState } from '@/lib/paperState'

export const maxDuration = 120
const RESERVED_COST = 0.10

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) + ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Geen geldige krantsessie' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ success: false, error: 'API niet geconfigureerd' }, { status: 503 })

  const rateLimit = await checkRateLimit(request, 'paper')
  if (!rateLimit.allowed) return NextResponse.json({ success: false, error: 'Generatie tijdelijk niet beschikbaar' }, { status: rateLimit.unavailable ? 503 : 429 })
  const reservation = await reserveDailyCost(RESERVED_COST)
  if (!reservation.ok) return NextResponse.json({ success: false, error: reservation.unavailable ? 'Generatie tijdelijk niet beschikbaar' : 'Dagbudget bereikt' }, { status: reservation.unavailable ? 503 : 429 })

  try {
    const data: any = await loadPaperState(session.paperId)
    if (!data?.basisGegevens?.volledigeNaam || !data?.basisGegevens?.geboorteDatum) {
      await settleDailyCost(RESERVED_COST, 0)
      return NextResponse.json({ success: false, error: 'Vul eerst naam en geboortedatum in' }, { status: 400 })
    }
    const inputSize = Buffer.byteLength(JSON.stringify(data), 'utf8')
    if (inputSize > 64 * 1024) {
      await settleDailyCost(RESERVED_COST, 0)
      return NextResponse.json({ success: false, error: 'Invoer is te groot' }, { status: 413 })
    }

    const geboorteDatum = data.basisGegevens.geboorteDatum
    const [nieuwsFacts, cultuurFacts] = await Promise.all([gatherNewsFacts(geboorteDatum), gatherCultuurFacts(geboorteDatum)])
    data.gatheredFacts = { nieuws: nieuwsFacts.combined, cultuur: cultuurFacts.combined }
    const result = await callClaudeStructured<Record<ArticleSection, string>>(buildFullPaperPrompt(data), SYSTEM_PROMPT, PAPER_TOOL)
    const articles = result.data
    const wordCounts = Object.fromEntries(Object.entries(articles).map(([section, text]) => [section, String(text).trim().split(/\s+/).filter(Boolean).length]))
    const cost = calculateCost(result.tokensUsed.input, result.tokensUsed.output)
    await settleDailyCost(RESERVED_COST, cost)
    const { error } = await getSupabaseAdmin().from('generated_papers').update({ generated_articles: articles, manual_edits: articles, status: 'generated' }).eq('id', session.paperId)
    if (error) throw error
    return NextResponse.json({ success: true, articles, wordCounts, tokensUsed: result.tokensUsed.input + result.tokensUsed.output, cost })
  } catch (error) {
    console.error('[GeneratePaper] Error:', error)
    return NextResponse.json({ success: false, error: 'Generatie mislukt' }, { status: 500 })
  }
}
