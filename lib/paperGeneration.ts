import 'server-only'

import { CLAUDE_PRICING } from './articleTypes'
import type { ArticleSection } from './articleTypes'
import { callClaudeStructured } from './claude'
import { getBornOnThisDay } from './bornOnThisDayAPI'
import { getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur, getSterrenbeeld } from './calculations'
import { gatherCultuurFacts, gatherNewsFacts } from './factGathering'
import { getFamousNamesakes } from './famousNamesakesAPI'
import { PAPER_TOOL, SYSTEM_PROMPT, buildFullPaperPrompt } from './prompts'
import { getSupabaseAdmin } from './supabase'
import { getHistoricalWeather } from './weatherAPI'
import { reserveDailyCost, settleDailyCost } from './rateLimit'

const RESERVED_COST = 0.10

export async function processNextPaperGenerationJob(): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_paper_generation_job')
  const job = data?.[0]
  if (error) throw error
  if (!job) return false

  let reserved = false
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI-provider is niet geconfigureerd')
    const reservation = await reserveDailyCost(RESERVED_COST)
    if (!reservation.ok) throw new Error(reservation.unavailable ? 'Kostenregistratie niet beschikbaar' : 'Dagbudget bereikt')
    reserved = true

    const { data: paper, error: paperError } = await supabase.from('generated_papers')
      .select('form_data').eq('id', job.paper_id).single()
    if (paperError || !paper) throw new Error('Krant niet gevonden')
    const state: any = paper.form_data || {}
    const basis = state.basisGegevens || {}
    const birthDate = basis.geboorteDatum
    const birthPlace = basis.geboorteplaats
    const fullName = basis.volledigeNaam
    if (!fullName || !birthDate) throw new Error('Naam en geboortedatum ontbreken')

    state.berekend = {
      sterrenbeeld: getSterrenbeeld(birthDate), chineesJaar: getChineesJaar(birthDate),
      geboortebloem: getGeboortebloem(birthDate), geboortesteen: getGeboortesteen(birthDate), kleur: getKleur(birthDate),
    }
    const [nieuws, cultuur, weather, bornPersons, famousNamesakes] = await Promise.all([
      gatherNewsFacts(birthDate), gatherCultuurFacts(birthDate),
      birthPlace ? getHistoricalWeather(birthDate, birthPlace) : null,
      getBornOnThisDay(birthDate), getFamousNamesakes(fullName),
    ])
    state.gatheredFacts = { nieuws: nieuws.combined, cultuur: cultuur.combined }
    state.weather = weather || undefined
    state.bornPersons = bornPersons.length ? bornPersons : undefined
    state.famousNamesakes = famousNamesakes

    const result = await callClaudeStructured<Record<ArticleSection, string>>(
      buildFullPaperPrompt(state), SYSTEM_PROMPT, PAPER_TOOL
    )
    const cost = result.tokensUsed.input / 1_000_000 * CLAUDE_PRICING.inputCostPer1MTokens
      + result.tokensUsed.output / 1_000_000 * CLAUDE_PRICING.outputCostPer1MTokens
    await settleDailyCost(RESERVED_COST, cost)
    reserved = false
    const { error: completeError } = await supabase.rpc('complete_paper_generation_job', {
      p_job_id: job.id, p_articles: result.data, p_form_data: state,
    })
    if (completeError) throw completeError
  } catch (cause) {
    if (reserved) await settleDailyCost(RESERVED_COST, 0)
    const message = cause instanceof Error ? cause.message : 'Onbekende generatiefout'
    console.error('[PaperGenerationWorker]', message)
    await supabase.rpc('fail_paper_generation_job', { p_job_id: job.id, p_error: message })
  }
  return true
}
