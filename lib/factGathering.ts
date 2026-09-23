// lib/factGathering.ts
// Feitenverzameling via OpenAI met websearch voor de nieuws- en cultuursecties.
// Eén onderzoeker per sectie; zonder webbronnen telt het onderzoek niet.

import { callOpenAIResearch, researchModel } from './openai'
import { gatherWaybackResearch } from './waybackResearch'

export interface FactResult {
  model: string
  text: string
  durationMs: number
  error?: string
  sources?: { name: string; url: string }[]
  usage?: unknown
}

export interface GatheredFacts {
  results: FactResult[]
  combined: string
}

// ---------------------------------------------------------------------------
// Prompts voor feitenverzameling
// ---------------------------------------------------------------------------

function nieuwsFeitenPrompt(datum: string): string {
  return `Zoek het nieuws op van precies ${datum}. Doel: bepalen wat die dag het belangrijkste en meest besproken nieuws was, in Nederland en internationaal.

Zoek gericht:
- wat die dag bovenaan stond bij NOS en NU.nl (Nederlandse politiek, binnenlands nieuws);
- het grootste internationale nieuws van die dag;
- sport (wedstrijden, uitslagen, toernooien die die dag speelden);
- wetenschap, cultuur of iets opvallends of lichts.

Geef 12-15 kandidaat-items. Per item:
- wat er gebeurde, met concrete details (namen, plaatsen, getallen);
- de datum van de gebeurtenis (niet alleen de publicatiedatum);
- de bron;
- het belang: TOP (openingsnieuws of voorpagina die dag), GROOT of KLEIN.

Neem alleen nieuws op dat op ${datum} gebeurde of die dag groot in het nieuws was. Een lopende verhaallijn mag alleen met een concreet feit van die dag. Geef alleen verifieerbare feiten, geen interpretaties. Antwoord in het Nederlands.`
}

function cultuurFeitenPrompt(datum: string): string {
  return `Zoek op wat er op cultureel gebied speelde rond ${datum} in Nederland. Geef een feitelijke opsomming van: (1) de nummer 1 in de Nederlandse Top 40, (2) andere populaire muziek, (3) de grote bioscoopfilms in Nederland, (4) trending series op Netflix, Apple TV+, Disney+, Prime Video en andere streamingdiensten, (5) opvallende TV-programma's op de Nederlandse televisie. Raadpleeg Top40.nl, Filmvandaag.nl, VPRO Cinema, en trending lijsten van streamingdiensten. Geef alleen verifieerbare feiten, geen waardeoordelen. Antwoord in het Nederlands.`
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function research(prompt: string, maxToolCalls: number): Promise<FactResult> {
  const model = researchModel()
  const start = Date.now()
  try {
    const result = await callOpenAIResearch(prompt, { maxToolCalls })
    return { model: result.model, text: result.text, sources: result.sources, usage: result.usage, durationMs: Date.now() - start }
  } catch (err) {
    return { model, text: '', durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Publieke functies: feiten verzamelen per sectie
// ---------------------------------------------------------------------------

function combineResults(results: FactResult[]): string {
  const parts: string[] = []
  results.forEach((r) => {
    if (r.text) {
      parts.push(`[Bron: ${r.model}]\n${r.text}`)
    }
  })
  return parts.join('\n\n---\n\n')
}

export async function gatherNewsFacts(datum: string): Promise<GatheredFacts> {
  const result = await research(nieuwsFeitenPrompt(datum), 5)
  if (result.error) console.warn(`[FactGathering] ${result.model} nieuws fout: ${result.error}`)
  else console.log(`[FactGathering] ${result.model} nieuws OK (${result.durationMs}ms)`)
  return { results: [result], combined: combineResults([result]) }
}

export async function gatherCultuurFacts(datum: string): Promise<GatheredFacts> {
  const result = await research(cultuurFeitenPrompt(datum), 3)
  if (result.error) console.warn(`[FactGathering] ${result.model} cultuur fout: ${result.error}`)
  else console.log(`[FactGathering] ${result.model} cultuur OK (${result.durationMs}ms)`)
  return { results: [result], combined: combineResults([result]) }
}

/**
 * Nieuwsonderzoek plus de voorpaginakoppen van NOS en NU.nl van die dag.
 * Beide lopen tegelijk; de koppen tonen wat die dag echt bovenaan stond.
 */
export async function gatherNewsEvidence(datum: string): Promise<GatheredFacts> {
  const [facts, archive] = await Promise.all([
    gatherNewsFacts(datum),
    gatherWaybackResearch(datum).catch(() => ({ text: '', sources: [], results: [] })),
  ])
  return { results: facts.results, combined: [facts.combined, archive.text].filter(Boolean).join('\n\n') }
}
