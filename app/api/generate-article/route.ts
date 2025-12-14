// app/api/generate-article/route.ts
// @version 1.0.0 - PLACEHOLDER voor Gemini integratie

import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationRequest, ArticleGenerationResponse, UsageStats } from '@/lib/articleTypes'
import { USAGE_LIMITS, GEMINI_PRICING } from '@/lib/articleTypes'

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
  return ((inputTokens / 1_000_000) * GEMINI_PRICING.inputCostPer1MTokens) +
         ((outputTokens / 1_000_000) * GEMINI_PRICING.outputCostPer1MTokens)
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

    const apiKey = process.env.GEMINI_API_KEY
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
        error: `Budget limiet bereikt (€${USAGE_LIMITS.maxCostPerDay})`,
        remainingRequests: USAGE_LIMITS.maxRequestsPerDay - usage.requestsToday,
        dailyCost: usage.costToday
      } as ArticleGenerationResponse, { status: 429 })
    }

    console.log(`[API] Generating ${section} (session: ${sessionId}, usage: ${usage.requestsToday}/${USAGE_LIMITS.maxRequestsPerDay})`)
    
    // PLACEHOLDER - wordt vervangen door Gemini
    const placeholderText = `[TEST] Gegenereerd artikel voor "${section}".

Ontvangen data: ${Object.keys(data).join(', ')}

Dit wordt vervangen door echte AI tekst.`

    const mockCost = calculateCost(200, 150)
    updateUsageStats(sessionId, mockCost)
    const updatedUsage = getUsageStats(sessionId)

    return NextResponse.json({
      success: true,
      section,
      text: placeholderText,
      wordCount: placeholderText.split(' ').length,
      tokensUsed: 350,
      cost: mockCost,
      remainingRequests: USAGE_LIMITS.maxRequestsPerDay - updatedUsage.requestsToday,
      dailyCost: updatedUsage.costToday
    } as ArticleGenerationResponse)

  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Er ging iets mis'
    } as ArticleGenerationResponse, { status: 500 })
  }
}