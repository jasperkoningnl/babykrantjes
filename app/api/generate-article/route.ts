import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationResponse, ArticleSection } from '@/lib/articleTypes'
import { ARTICLE_SECTIONS } from '@/lib/articleTypes'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/prompts'
import { callOpenAI, OPENAI_PRICING } from '@/lib/openai'
import { checkRateLimit, reserveDailyCost, settleDailyCost } from '@/lib/rateLimit'
import { findPaperSession } from '@/lib/paperSession'
import { loadPaperState } from '@/lib/paperState'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fillName, getPublishedText } from '@/lib/contentLibrary'

export const maxDuration = 120
const RESERVED_COST = 0.20

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * OPENAI_PRICING.inputCostPer1MTokens) + ((outputTokens / 1_000_000) * OPENAI_PRICING.outputCostPer1MTokens)
}

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Geen geldige krantsessie' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const section = String(body?.section || '') as ArticleSection
  if (!Object.prototype.hasOwnProperty.call(ARTICLE_SECTIONS, section)) return NextResponse.json({ success: false, error: 'Ongeldige sectie' }, { status: 400 })

  const rateLimit = await checkRateLimit(request, 'article')
  if (!rateLimit.allowed) return NextResponse.json({ success: false, error: 'Generatie tijdelijk niet beschikbaar', remainingRequests: 0 }, { status: rateLimit.unavailable ? 503 : 429 })
  if (section === 'nieuws' || section === 'cultuur') return libraryArticle(section, session.paperId)
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ success: false, error: 'API niet geconfigureerd' }, { status: 503 })
  const reservation = await reserveDailyCost(RESERVED_COST)
  if (!reservation.ok) return NextResponse.json({ success: false, error: reservation.unavailable ? 'Generatie tijdelijk niet beschikbaar' : 'Dagbudget bereikt' }, { status: reservation.unavailable ? 503 : 429 })

  let stage = 'laden'
  try {
    const data: any = await loadPaperState(session.paperId)
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 64 * 1024) {
      await settleDailyCost(RESERVED_COST, 0)
      return NextResponse.json({ success: false, error: 'Invoer is te groot' }, { status: 413 })
    }
    stage = 'schrijven'
    const result = await callOpenAI(buildPrompt(section, data), SYSTEM_PROMPT)
    const text = result.text.trim()
    const cost = calculateCost(result.tokensUsed.input, result.tokensUsed.output)
    await settleDailyCost(RESERVED_COST, cost)

    stage = 'opslaan'
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
    console.error(`[GenerateArticle] ${section} mislukt bij ${stage}:`, error)
    return NextResponse.json({ success: false, error: 'Generatie mislukt' }, { status: 500 })
  }
}

/** Nieuws en cultuur komen uit de redactiebibliotheek: opnieuw ophalen haalt de actuele versie, zonder AI-kosten. */
async function libraryArticle(section: 'nieuws' | 'cultuur', paperId: string) {
  try {
    const data: any = await loadPaperState(paperId)
    const date = data.basisGegevens?.geboorteDatum || ''
    const published = date ? await getPublishedText(section === 'nieuws' ? 'news' : 'culture', date) : null
    if (!published) return NextResponse.json({ success: false, section, error: 'Voor deze datum staat nog geen artikel klaar' }, { status: 404 })
    const text = fillName(published, String(data.basisGegevens?.volledigeNaam || '').trim().split(/\s+/)[0])
    const edits = { ...(data.generatedArticles || {}), ...(data.manualEdits || {}), [section]: text }
    const { error } = await getSupabaseAdmin().from('generated_papers').update({ manual_edits: edits }).eq('id', paperId)
    if (error) throw error
    return NextResponse.json({ success: true, section, text, wordCount: text.split(/\s+/).filter(Boolean).length, tokensUsed: 0, cost: 0 } as ArticleGenerationResponse)
  } catch (error) {
    console.error(`[GenerateArticle] ${section} uit bibliotheek mislukt:`, error)
    return NextResponse.json({ success: false, error: 'Ophalen mislukt' }, { status: 500 })
  }
}
