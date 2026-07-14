// app/api/generate-article/route.ts
// @version 3.1.0 - Server-side rate limiting op IP (Upstash) i.p.v. de
// in-memory Map met client-gekozen sessionId. Prompts en Claude-call leven
// in lib/prompts.ts en lib/claude.ts; model is Haiku 4.5. Deze route blijft
// bestaan voor per-sectie (re)generatie; de complete krant gaat via
// /api/generate-paper.

import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationRequest, ArticleGenerationResponse } from '@/lib/articleTypes'
import { USAGE_LIMITS, CLAUDE_PRICING } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/prompts'
import { callClaude } from '@/lib/claude'
import { enrichNewsData } from '@/lib/newsContext'
import { checkRateLimit, addDailyCost, getDailyCost, DAILY_COST_BUDGET } from '@/lib/rateLimit'

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) +
         ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  try {
    const body: ArticleGenerationRequest = await request.json()
    const { section, data } = body

    if (!section || !data) {
      return NextResponse.json({
        success: false,
        error: 'Missende velden'
      } as ArticleGenerationResponse, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API niet geconfigureerd'
      } as ArticleGenerationResponse, { status: 500 })
    }

    // Rate limiting op IP, server-side
    const rateLimit = await checkRateLimit(request, 'article')
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: `Limiet bereikt (${USAGE_LIMITS.maxRequestsPerDay}/dag)`,
        remainingRequests: 0
      } as ArticleGenerationResponse, { status: 429 })
    }

    // Globaal dagbudget (alle gebruikers samen)
    const dailyCost = await getDailyCost()
    if (dailyCost >= DAILY_COST_BUDGET) {
      return NextResponse.json({
        success: false,
        error: 'Dagbudget bereikt, probeer het morgen opnieuw',
        remainingRequests: rateLimit.remaining
      } as ArticleGenerationResponse, { status: 429 })
    }

    console.log(`[API] Generating ${section}`)

    // Voor de nieuwssectie: verrijk server-side met Supabase-data
    // (Google News van de geboortedag + dossiers die toen actief waren).
    if (section === 'nieuws') {
      await enrichNewsData(data)
    }

    // Build prompt
    const userPrompt = buildPrompt(section, data)

    // Call Claude
    const claudeResult = await callClaude(userPrompt, SYSTEM_PROMPT)

    const totalTokens = claudeResult.tokensUsed.input + claudeResult.tokensUsed.output
    const cost = calculateCost(claudeResult.tokensUsed.input, claudeResult.tokensUsed.output)
    const newDailyCost = await addDailyCost(cost)

    console.log(`[API] Success - ${totalTokens} tokens, $${cost.toFixed(4)} (dag: $${newDailyCost >= 0 ? newDailyCost.toFixed(4) : 'onbekend'})`)

    return NextResponse.json({
      success: true,
      section,
      text: claudeResult.text.trim(),
      wordCount: claudeResult.text.trim().split(/\s+/).length,
      tokensUsed: totalTokens,
      cost,
      remainingRequests: rateLimit.enforced ? rateLimit.remaining : undefined,
      dailyCost: newDailyCost >= 0 ? newDailyCost : undefined
    } as ArticleGenerationResponse)

  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Er ging iets mis'
    } as ArticleGenerationResponse, { status: 500 })
  }
}
