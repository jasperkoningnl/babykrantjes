// app/api/generate-paper/route.ts
// @version 1.0.0
// Genereert de complete babykrant (alle acht secties) in één gestructureerde
// Claude-call: één system prompt, één user prompt met alle data, één response.
// Goedkoper en consistenter van toon dan acht losse calls. Per-sectie
// regeneratie blijft mogelijk via /api/generate-article.

import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_PRICING } from '@/lib/articleTypes'
import type { ArticleSection } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildFullPaperPrompt, PAPER_TOOL } from '@/lib/prompts'
import { callClaudeStructured } from '@/lib/claude'
import { enrichNewsData } from '@/lib/newsContext'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase'

export interface PaperGenerationResponse {
  success: boolean
  articles?: Record<ArticleSection, string>
  wordCounts?: Record<ArticleSection, number>
  tokensUsed?: number
  cost?: number
  error?: string
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) +
         ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = body?.data

    if (!data?.basisGegevens) {
      return NextResponse.json(
        { success: false, error: 'Missende velden (data.basisGegevens)' } as PaperGenerationResponse,
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'API niet geconfigureerd' } as PaperGenerationResponse,
        { status: 500 }
      )
    }

    // Nieuws-context (Google News + actieve dossiers) server-side toevoegen
    await enrichNewsData(data)

    const userPrompt = buildFullPaperPrompt(data)
    console.log(`[GeneratePaper] Eén gestructureerde call voor ${data.basisGegevens?.volledigeNaam || 'onbekend'}`)

    const result = await callClaudeStructured<Record<ArticleSection, string>>(
      userPrompt,
      SYSTEM_PROMPT,
      PAPER_TOOL
    )

    const articles = result.data
    const wordCounts = Object.fromEntries(
      Object.entries(articles).map(([section, text]) => [
        section,
        String(text).trim().split(/\s+/).filter(Boolean).length,
      ])
    ) as Record<ArticleSection, number>

    const totalTokens = result.tokensUsed.input + result.tokensUsed.output
    const cost = calculateCost(result.tokensUsed.input, result.tokensUsed.output)
    console.log(`[GeneratePaper] Succes - ${totalTokens} tokens, $${cost.toFixed(4)}`)

    // Resultaat opslaan bij de concept-krant (indien aanwezig)
    const paperId = String(body?.paperId || data?.paperId || '').trim()
    if (paperId && isSupabaseAdminConfigured()) {
      const { error } = await getSupabaseAdmin()
        .from('generated_papers')
        .update({ generated_articles: articles, status: 'generated' })
        .eq('id', paperId)
      if (error) console.error('[GeneratePaper] Kon generated_papers niet bijwerken:', error.message)
    }

    return NextResponse.json({
      success: true,
      articles,
      wordCounts,
      tokensUsed: totalTokens,
      cost,
    } as PaperGenerationResponse)
  } catch (error) {
    console.error('[GeneratePaper] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Er ging iets mis',
      } as PaperGenerationResponse,
      { status: 500 }
    )
  }
}
