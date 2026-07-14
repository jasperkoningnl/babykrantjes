// app/api/generate-article/route.ts
// @version 3.0.0 - Prompts en Claude-call verplaatst naar lib/prompts.ts en
// lib/claude.ts; model geüpgraded naar Haiku 4.5. Deze route blijft bestaan
// voor per-sectie (re)generatie; de complete krant gaat via /api/generate-paper.

import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationRequest, ArticleGenerationResponse, UsageStats } from '@/lib/articleTypes'
import { USAGE_LIMITS, CLAUDE_PRICING } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/prompts'
import { callClaude } from '@/lib/claude'
import { enrichNewsData } from '@/lib/newsContext'

const dailyUsage = new Map<string, UsageStats>()

function isNewDay(lastDate: string): boolean {
  return new Date(lastDate).toDateString() !== new Date().toDateString()
}

function getUsageStats(sessionId: string): UsageStats {
  const existing = dailyUsage.get(sessionId)
  if (!existing || isNewDay(existing.lastRequestAt)) {
    const newStats: UsageStats = {
      requestsToday: 0,
      costToday: 0,
      lastRequestAt: new Date().toISOString()
    }
    dailyUsage.set(sessionId, newStats)
    return newStats
  }
  return existing
}

function updateUsageStats(sessionId: string, cost: number) {
  const stats = getUsageStats(sessionId)
  stats.requestsToday += 1
  stats.costToday += cost
  stats.lastRequestAt = new Date().toISOString()
  dailyUsage.set(sessionId, stats)
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) +
         ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  try {
    const body: ArticleGenerationRequest = await request.json()
    const { section, data, sessionId } = body

    if (!section || !data || !sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missende velden'
      } as ArticleGenerationResponse, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API niet geconfigureerd'
      } as ArticleGenerationResponse, { status: 500 })
    }

    const usage = getUsageStats(sessionId)

    if (usage.requestsToday >= USAGE_LIMITS.maxRequestsPerDay) {
      return NextResponse.json({
        success: false,
        error: `Limiet bereikt (${USAGE_LIMITS.maxRequestsPerDay}/dag)`,
        remainingRequests: 0,
        dailyCost: usage.costToday
      } as ArticleGenerationResponse, { status: 429 })
    }

    if (usage.costToday >= USAGE_LIMITS.maxCostPerDay) {
      return NextResponse.json({
        success: false,
        error: `Budget limiet bereikt ($${USAGE_LIMITS.maxCostPerDay})`,
        remainingRequests: USAGE_LIMITS.maxRequestsPerDay - usage.requestsToday,
        dailyCost: usage.costToday
      } as ArticleGenerationResponse, { status: 429 })
    }

    console.log(`[API] Generating ${section} (session: ${sessionId})`)

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

    updateUsageStats(sessionId, cost)
    const updatedUsage = getUsageStats(sessionId)

    console.log(`[API] Success - ${totalTokens} tokens, $${cost.toFixed(4)}`)

    return NextResponse.json({
      success: true,
      section,
      text: claudeResult.text.trim(),
      wordCount: claudeResult.text.trim().split(/\s+/).length,
      tokensUsed: totalTokens,
      cost,
      remainingRequests: USAGE_LIMITS.maxRequestsPerDay - updatedUsage.requestsToday,
      dailyCost: updatedUsage.costToday
    } as ArticleGenerationResponse)

  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Er ging iets mis'
    } as ArticleGenerationResponse, { status: 500 })
  }
}