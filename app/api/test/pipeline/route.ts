// app/api/test/pipeline/route.ts
// Testpipeline API: ChatGPT/Gemini feitenverzameling → Claude artikelgeneratie.
// Streamt voortgang via Server-Sent Events.

import { NextRequest } from 'next/server'

export const maxDuration = 120

const CLAUDE_MODEL = 'claude-haiku-4-5'
const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-3.6-flash'

type Sectie = 'nieuws' | 'cultuur'
type Variant = 'chatgpt' | 'gemini'

interface TokenCost {
  input: number
  output: number
  inputCostPer1M: number
  outputCostPer1M: number
  totalCostUSD: number
}

interface StepResult {
  model: string
  text: string
  tokens: TokenCost
  durationMs: number
  error?: string
}

interface PipelineResult {
  datum: string
  roepnaam: string
  sectie: Sectie
  variant: Variant
  stap1: StepResult
  stap2: StepResult
}

// ---------------------------------------------------------------------------
// Token cost calculations
// ---------------------------------------------------------------------------

function calculateCost(model: string, inputTokens: number, outputTokens: number): TokenCost {
  const pricing: Record<string, [number, number]> = {
    [OPENAI_MODEL]: [0.15, 0.60],
    [GEMINI_MODEL]: [0.10, 0.40],
    [CLAUDE_MODEL]: [1.00, 5.00],
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
// Prompts stap 1
// ---------------------------------------------------------------------------

function feitenPrompt(sectie: Sectie, datum: string): string {
  if (sectie === 'nieuws') {
    return `Zoek het nieuws op van ${datum}. Geef een feitelijke opsomming van 6-8 nieuwsitems die op of rond deze dag speelden, met voor elk item: wat er gebeurde, wanneer, en waarom het relevant is. Mix Nederlands en internationaal nieuws. Noem ook grote lopende verhaallijnen die het nieuws in die periode domineerden, met een concreet feit van die dag als aanleiding. Noem ook grote evenementen, festivals of sportevenementen die op deze dag plaatsvonden of van start gingen, als die relevant genoeg zijn. Geef alleen verifieerbare feiten, geen interpretaties. Antwoord in het Nederlands.`
  }
  return `Zoek op wat er op cultureel gebied speelde rond ${datum} in Nederland. Geef een feitelijke opsomming van: (1) de nummer 1 in de Nederlandse Top 40, (2) andere populaire muziek, (3) de grote bioscoopfilms in Nederland, (4) trending series op Netflix, Apple TV+, Disney+, Prime Video en andere streamingdiensten, (5) opvallende TV-programma's op de Nederlandse televisie. Raadpleeg Top40.nl, Filmvandaag.nl, VPRO Cinema, en trending lijsten van streamingdiensten. Geef alleen verifieerbare feiten, geen waardeoordelen. Antwoord in het Nederlands.`
}

// ---------------------------------------------------------------------------
// Prompts stap 2
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
// API calls
// ---------------------------------------------------------------------------

async function callOpenAI(prompt: string): Promise<StepResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { model: OPENAI_MODEL, text: '', tokens: calculateCost(OPENAI_MODEL, 0, 0), durationMs: 0, error: 'OPENAI_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, tools: [{ type: 'web_search_preview' }], input: prompt }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    const text = (data.output ?? [])
      .filter((item: any) => item.type === 'message')
      .flatMap((item: any) => (item.content ?? []))
      .filter((c: any) => c.type === 'output_text')
      .map((c: any) => c.text)
      .join('\n')

    return {
      model: OPENAI_MODEL,
      text,
      tokens: calculateCost(OPENAI_MODEL, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return { model: OPENAI_MODEL, text: '', tokens: calculateCost(OPENAI_MODEL, 0, 0), durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

async function callGemini(prompt: string): Promise<StepResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { model: GEMINI_MODEL, text: '', tokens: calculateCost(GEMINI_MODEL, 0, 0), durationMs: 0, error: 'GEMINI_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
    const usage = data.usageMetadata ?? {}

    return {
      model: GEMINI_MODEL,
      text,
      tokens: calculateCost(GEMINI_MODEL, usage.promptTokenCount ?? 0, usage.candidatesTokenCount ?? 0),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return { model: GEMINI_MODEL, text: '', tokens: calculateCost(GEMINI_MODEL, 0, 0), durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

async function callClaude(prompt: string, systemPrompt: string): Promise<StepResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { model: CLAUDE_MODEL, text: '', tokens: calculateCost(CLAUDE_MODEL, 0, 0), durationMs: 0, error: 'ANTHROPIC_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    })
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    return {
      model: CLAUDE_MODEL,
      text: data.content?.[0]?.text ?? '',
      tokens: calculateCost(CLAUDE_MODEL, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return { model: CLAUDE_MODEL, text: '', tokens: calculateCost(CLAUDE_MODEL, 0, 0), durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// SSE stream handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.json() as { datum: string; roepnaam: string }
  const { datum, roepnaam } = body

  if (!datum || !roepnaam) {
    return new Response(JSON.stringify({ error: 'datum en roepnaam zijn verplicht' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const results: PipelineResult[] = []
      const secties: Sectie[] = ['nieuws', 'cultuur']
      const varianten: Variant[] = ['chatgpt', 'gemini']
      const total = secties.length * varianten.length * 2
      let step = 0

      for (const sectie of secties) {
        for (const variant of varianten) {
          const label = `${sectie}/${variant}`

          send('progress', { step: ++step, total, label, phase: 'feiten', sectie, variant })
          const prompt1 = feitenPrompt(sectie, datum)
          const stap1 = variant === 'chatgpt' ? await callOpenAI(prompt1) : await callGemini(prompt1)

          send('step_done', { step, label: `${label}/feiten`, result: stap1 })

          let stap2: StepResult
          if (stap1.error) {
            stap2 = { model: CLAUDE_MODEL, text: '', tokens: calculateCost(CLAUDE_MODEL, 0, 0), durationMs: 0, error: 'Overgeslagen: stap 1 faalde' }
          } else {
            send('progress', { step: ++step, total, label, phase: 'artikel', sectie, variant })
            const prompt2 = artikelPrompt(sectie, datum, roepnaam, stap1.text)
            stap2 = await callClaude(prompt2, CLAUDE_SYSTEM_PROMPT)
            send('step_done', { step, label: `${label}/artikel`, result: stap2 })
          }

          const result: PipelineResult = { datum, roepnaam, sectie, variant, stap1, stap2 }
          results.push(result)
          send('result', result)
        }
      }

      const totalCost = results.reduce((sum, r) => sum + r.stap1.tokens.totalCostUSD + r.stap2.tokens.totalCostUSD, 0)
      send('done', { results, totalCost })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
