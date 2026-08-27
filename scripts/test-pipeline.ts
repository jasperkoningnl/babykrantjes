#!/usr/bin/env tsx
// scripts/test-pipeline.ts
// Testpipeline: vergelijk ChatGPT vs Gemini feitenverzameling → Claude artikelgeneratie.
//
// Gebruik:
//   npx tsx scripts/test-pipeline.ts
//
// Vereiste env vars: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY

import fs from 'fs/promises'
import path from 'path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLAUDE_MODEL = 'claude-haiku-4-5-20250901'
const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-2.0-flash'

const TESTCASES = [
  { datum: 'dinsdag 14 januari 2025', roepnaam: 'Emma' },
  { datum: 'vrijdag 21 augustus 2026', roepnaam: 'Lena' },
  { datum: 'woensdag 12 maart 2014', roepnaam: 'Sem' },
]

type Sectie = 'nieuws' | 'cultuur'
type Variant = 'chatgpt' | 'gemini'

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Ontbrekende env var: ${name}`)
  return val
}

// ---------------------------------------------------------------------------
// Prompts stap 1 (feitenverzameling)
// ---------------------------------------------------------------------------

function feitenPrompt(sectie: Sectie, datum: string): string {
  if (sectie === 'nieuws') {
    return `Zoek het nieuws op van ${datum}. Geef een feitelijke opsomming van 6-8 nieuwsitems die op of rond deze dag speelden, met voor elk item: wat er gebeurde, wanneer, en waarom het relevant is. Mix Nederlands en internationaal nieuws. Noem ook grote lopende verhaallijnen die het nieuws in die periode domineerden, met een concreet feit van die dag als aanleiding. Noem ook grote evenementen, festivals of sportevenementen die op deze dag plaatsvonden of van start gingen, als die relevant genoeg zijn. Geef alleen verifieerbare feiten, geen interpretaties. Antwoord in het Nederlands.`
  }
  return `Zoek op wat er op cultureel gebied speelde rond ${datum} in Nederland. Geef een feitelijke opsomming van: (1) de nummer 1 in de Nederlandse Top 40, (2) andere populaire muziek, (3) de grote bioscoopfilms in Nederland, (4) trending series op Netflix, Apple TV+, Disney+, Prime Video en andere streamingdiensten, (5) opvallende TV-programma's op de Nederlandse televisie. Raadpleeg Top40.nl, Filmvandaag.nl, VPRO Cinema, en trending lijsten van streamingdiensten. Geef alleen verifieerbare feiten, geen waardeoordelen. Antwoord in het Nederlands.`
}

// ---------------------------------------------------------------------------
// Prompts stap 2 (Claude artikelgeneratie)
// ---------------------------------------------------------------------------

const CLAUDE_SYSTEM_PROMPT = 'Je bent een journalist die een babykrant schrijft voor Nederlandse ouders. Warm maar niet sentimenteel, informatief, Nederlandse context. Geen Markdown. Geen \'zo bijzonder!\'-taal.'

function artikelPrompt(sectie: Sectie, datum: string, roepnaam: string, feiten: string): string {
  if (sectie === 'nieuws') {
    return `Hieronder staan feiten over het nieuws op ${datum}. Schrijf hier één doorlopend nieuwsverhaal van 120-180 woorden voor een babykrant over de geboorte van ${roepnaam}.

STRUCTUUR:
- Open met: "De geboorte van ${roepnaam} was het grootste nieuws op ${datum}, maar er gebeurde meer."
- Begin met een pakkend maar niet deprimerend nieuwsitem. Geen ongelukken, rampen of doden als opening.
- Maak thematische bruggetjes tussen de onderwerpen. Spring niet willekeurig van item naar item, maar zoek verbindingen.
- Selecteer 4-6 items uit de aangeleverde feiten. Kies op basis van:
  * Tijdsbeeld: de grote verhaallijnen die dit jaar definiëren
  * Nederlands en persoonlijk: minister-president, unieke Nederlandse momenten
  * Over 3 jaar nog herkenbaar, geen eendagsvliegen
- Verwerk lopende internationale dossiers niet als apart blok, maar verweven in het verhaal via een logisch bruggetje
- Sluit af met iets lichts: sport, cultuur, of een grappig nieuwsfeit
- Geen hele specifieke details over aantallen gewonden of doden

REGELS:
- Gebruik ALLEEN feiten uit de aangeleverde lijst hieronder. Verzin niets.
- Geen kopjes, geen blokken, geen opsommingen. Eén doorlopend stuk tekst.
- Geen categorie-introducties zoals "In de sportwereld..."
- Schrijf zakelijk maar toegankelijk, in het Nederlands

FEITEN:
${feiten}`
  }

  return `Hieronder staan feiten over de cultuurwereld rond ${datum}. Schrijf een vloeiend overzicht van 120-160 woorden voor een babykrant over de geboorte van ${roepnaam}.

INHOUD (in deze volgorde):
1. De nummer 1-hit in de Top 40
2. Andere populaire muziek in die periode
3. Populaire bioscoopfilms waar iedereen het over had
4. De 2-3 populairste nieuwe series/seizoenen op streamingdiensten
5. Opvallende TV-programma's op de Nederlandse televisie

SELECTIECRITERIA:
- Bij films: kies de titels die cultureel impact hadden, niet elke actiefilm die toevallig draaide
- Bij series: focus op titels die trending waren, niet obscure releases
- Bij TV: kies programma's die het nationale gesprek bepaalden
- Geen kijkcijfers noemen

REGELS:
- Gebruik ALLEEN feiten uit de aangeleverde lijst hieronder. Verzin niets.
- Noem bij muziek de artiest EN de songtitel
- Noem bij films eventueel de regisseur als die algemeen bekend is
- Geen Markdown, geen waardeoordelen, geen overbodige intro- of slotzinnen
- Schrijf vlot en journalistiek, in het Nederlands

FEITEN:
${feiten}`
}

// ---------------------------------------------------------------------------
// Token cost calculations
// ---------------------------------------------------------------------------

interface TokenCost {
  input: number
  output: number
  inputCostPer1M: number
  outputCostPer1M: number
  totalCostUSD: number
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): TokenCost {
  const pricing: Record<string, [number, number]> = {
    [OPENAI_MODEL]: [0.15, 0.60],
    [GEMINI_MODEL]: [0.10, 0.40],
    [CLAUDE_MODEL]: [0.80, 4.00],
  }
  const [inp, outp] = pricing[model] ?? [0, 0]
  return {
    input: inputTokens,
    output: outputTokens,
    inputCostPer1M: inp,
    outputCostPer1M: outp,
    totalCostUSD: (inputTokens * inp + outputTokens * outp) / 1_000_000,
  }
}

// ---------------------------------------------------------------------------
// Step result
// ---------------------------------------------------------------------------

interface StepResult {
  model: string
  text: string
  tokens: TokenCost
  durationMs: number
  error?: string
}

// ---------------------------------------------------------------------------
// API: OpenAI (Responses API met web_search_preview)
// ---------------------------------------------------------------------------

async function callOpenAI(prompt: string): Promise<StepResult> {
  const apiKey = requireEnv('OPENAI_API_KEY')
  const start = Date.now()

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: 'web_search_preview' }],
        input: prompt,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI ${res.status}: ${errText}`)
    }

    const data = await res.json() as any
    const text = (data.output ?? [])
      .filter((item: any) => item.type === 'message')
      .flatMap((item: any) => (item.content ?? []))
      .filter((c: any) => c.type === 'output_text')
      .map((c: any) => c.text)
      .join('\n')

    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0

    return {
      model: OPENAI_MODEL,
      text,
      tokens: calculateCost(OPENAI_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      model: OPENAI_MODEL,
      text: '',
      tokens: calculateCost(OPENAI_MODEL, 0, 0),
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// API: Gemini (met Google Search grounding)
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<StepResult> {
  const apiKey = requireEnv('GEMINI_API_KEY')
  const start = Date.now()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini ${res.status}: ${errText}`)
    }

    const data = await res.json() as any
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? '')
      .join('')

    const usage = data.usageMetadata ?? {}
    const inputTokens = usage.promptTokenCount ?? 0
    const outputTokens = usage.candidatesTokenCount ?? 0

    return {
      model: GEMINI_MODEL,
      text,
      tokens: calculateCost(GEMINI_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      model: GEMINI_MODEL,
      text: '',
      tokens: calculateCost(GEMINI_MODEL, 0, 0),
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// API: Claude (artikel schrijven)
// ---------------------------------------------------------------------------

async function callClaude(prompt: string, systemPrompt: string): Promise<StepResult> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY')
  const start = Date.now()

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Claude ${res.status}: ${errText}`)
    }

    const data = await res.json() as any
    const text = data.content?.[0]?.text ?? ''
    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0

    return {
      model: CLAUDE_MODEL,
      text,
      tokens: calculateCost(CLAUDE_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      model: CLAUDE_MODEL,
      text: '',
      tokens: calculateCost(CLAUDE_MODEL, 0, 0),
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline per sectie + variant
// ---------------------------------------------------------------------------

interface PipelineResult {
  datum: string
  roepnaam: string
  sectie: Sectie
  variant: Variant
  stap1: StepResult
  stap2: StepResult
}

async function runPipeline(
  datum: string,
  roepnaam: string,
  sectie: Sectie,
  variant: Variant
): Promise<PipelineResult> {
  const label = `[${roepnaam}/${sectie}/${variant}]`
  console.log(`  ${label} Stap 1: feiten ophalen via ${variant}...`)

  const prompt1 = feitenPrompt(sectie, datum)
  const stap1 = variant === 'chatgpt'
    ? await callOpenAI(prompt1)
    : await callGemini(prompt1)

  if (stap1.error) {
    console.log(`  ${label} Stap 1 FOUT: ${stap1.error}`)
    return { datum, roepnaam, sectie, variant, stap1, stap2: { model: CLAUDE_MODEL, text: '', tokens: calculateCost(CLAUDE_MODEL, 0, 0), durationMs: 0, error: 'Overgeslagen: stap 1 faalde' } }
  }

  console.log(`  ${label} Stap 1 klaar (${stap1.tokens.input}+${stap1.tokens.output} tokens, ${stap1.durationMs}ms)`)
  console.log(`  ${label} Stap 2: artikel schrijven via Claude...`)

  const prompt2 = artikelPrompt(sectie, datum, roepnaam, stap1.text)
  const stap2 = await callClaude(prompt2, CLAUDE_SYSTEM_PROMPT)

  if (stap2.error) {
    console.log(`  ${label} Stap 2 FOUT: ${stap2.error}`)
  } else {
    console.log(`  ${label} Stap 2 klaar (${stap2.tokens.input}+${stap2.tokens.output} tokens, ${stap2.durationMs}ms)`)
  }

  return { datum, roepnaam, sectie, variant, stap1, stap2 }
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function printResults(results: PipelineResult[]) {
  console.log('\n' + '='.repeat(80))
  console.log('RESULTATEN')
  console.log('='.repeat(80))

  const grouped = new Map<string, PipelineResult[]>()
  for (const r of results) {
    const key = `${r.datum} — ${r.roepnaam}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }

  let totalCost = 0

  grouped.forEach((items, key) => {
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`${key}`)
    console.log('─'.repeat(80))

    for (const sectie of ['nieuws', 'cultuur'] as Sectie[]) {
      const sectionItems = items.filter((i: PipelineResult) => i.sectie === sectie)
      if (sectionItems.length === 0) continue

      console.log(`\n  ▸ ${sectie.toUpperCase()}`)

      for (const item of sectionItems) {
        const variantLabel = item.variant === 'chatgpt' ? 'ChatGPT → Claude' : 'Gemini → Claude'
        console.log(`\n    [${variantLabel}]`)

        if (item.stap1.error) {
          console.log(`    Stap 1 FOUT: ${item.stap1.error}`)
        } else {
          console.log(`    Stap 1 (${item.stap1.model}): ${item.stap1.tokens.input}+${item.stap1.tokens.output} tokens, ${formatDuration(item.stap1.durationMs)}, ${formatCost(item.stap1.tokens.totalCostUSD)}`)
        }

        if (item.stap2.error) {
          console.log(`    Stap 2 FOUT: ${item.stap2.error}`)
        } else {
          console.log(`    Stap 2 (${item.stap2.model}): ${item.stap2.tokens.input}+${item.stap2.tokens.output} tokens, ${formatDuration(item.stap2.durationMs)}, ${formatCost(item.stap2.tokens.totalCostUSD)}`)
        }

        totalCost += item.stap1.tokens.totalCostUSD + item.stap2.tokens.totalCostUSD

        console.log()
        console.log(`    --- FEITEN (${item.variant}) ---`)
        console.log(indent(item.stap1.text || '(geen output)', 4))
        console.log()
        console.log(`    --- ARTIKEL ---`)
        console.log(indent(item.stap2.text || '(geen output)', 4))
      }
    }
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log(`TOTALE KOSTEN: ${formatCost(totalCost)}`)
  console.log('='.repeat(80))
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map(l => pad + l).join('\n')
}

// ---------------------------------------------------------------------------
// Save JSON
// ---------------------------------------------------------------------------

async function saveResults(results: PipelineResult[]) {
  const outDir = path.join(process.cwd(), 'scripts', 'output')
  await fs.mkdir(outDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(outDir, `test-pipeline-${timestamp}.json`)
  await fs.writeFile(filePath, JSON.stringify(results, null, 2))
  console.log(`\nJSON opgeslagen: ${filePath}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Babykrant Testpipeline ===')
  console.log(`Modellen: ${OPENAI_MODEL} / ${GEMINI_MODEL} → ${CLAUDE_MODEL}`)
  console.log(`Testcases: ${TESTCASES.length}\n`)

  const allResults: PipelineResult[] = []

  for (const { datum, roepnaam } of TESTCASES) {
    console.log(`\n▶ ${datum} — ${roepnaam}`)

    const secties: Sectie[] = ['nieuws', 'cultuur']
    const varianten: Variant[] = ['chatgpt', 'gemini']

    for (const sectie of secties) {
      for (const variant of varianten) {
        const result = await runPipeline(datum, roepnaam, sectie, variant)
        allResults.push(result)
      }
    }
  }

  printResults(allResults)
  await saveResults(allResults)
}

main().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
