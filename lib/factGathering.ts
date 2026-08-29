// lib/factGathering.ts
// Feitenverzameling via AI-modellen met websearch voor de nieuws- en cultuursecties.
//
// Nieuws:  ChatGPT (web search) + Claude (kennis) → feiten combineren
// Cultuur: ChatGPT (web search) + Claude (kennis) + Gemini (Google Search) → feiten combineren

const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-3.6-flash'
const CLAUDE_FACTS_MODEL = 'claude-haiku-4-5'

export interface FactResult {
  model: string
  text: string
  durationMs: number
  error?: string
}

export interface GatheredFacts {
  results: FactResult[]
  combined: string
}

// ---------------------------------------------------------------------------
// Prompts voor feitenverzameling
// ---------------------------------------------------------------------------

function nieuwsFeitenPrompt(datum: string): string {
  return `Zoek het nieuws op van ${datum}. Geef een feitelijke opsomming van 6-8 nieuwsitems die op of rond deze dag speelden, met voor elk item: wat er gebeurde, wanneer, en waarom het relevant is. Mix Nederlands en internationaal nieuws. Noem ook grote lopende verhaallijnen die het nieuws in die periode domineerden, met een concreet feit van die dag als aanleiding. Noem ook grote evenementen, festivals of sportevenementen die op deze dag plaatsvonden of van start gingen, als die relevant genoeg zijn. Geef alleen verifieerbare feiten, geen interpretaties. Antwoord in het Nederlands.`
}

function cultuurFeitenPrompt(datum: string): string {
  return `Zoek op wat er op cultureel gebied speelde rond ${datum} in Nederland. Geef een feitelijke opsomming van: (1) de nummer 1 in de Nederlandse Top 40, (2) andere populaire muziek, (3) de grote bioscoopfilms in Nederland, (4) trending series op Netflix, Apple TV+, Disney+, Prime Video en andere streamingdiensten, (5) opvallende TV-programma's op de Nederlandse televisie. Raadpleeg Top40.nl, Filmvandaag.nl, VPRO Cinema, en trending lijsten van streamingdiensten. Geef alleen verifieerbare feiten, geen waardeoordelen. Antwoord in het Nederlands.`
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function callOpenAISearch(prompt: string): Promise<FactResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { model: OPENAI_MODEL, text: '', durationMs: 0, error: 'OPENAI_API_KEY ontbreekt' }

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

    return { model: OPENAI_MODEL, text, durationMs: Date.now() - start }
  } catch (err) {
    return { model: OPENAI_MODEL, text: '', durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

async function callGeminiSearch(prompt: string): Promise<FactResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { model: GEMINI_MODEL, text: '', durationMs: 0, error: 'GEMINI_API_KEY ontbreekt' }

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

    return { model: GEMINI_MODEL, text, durationMs: Date.now() - start }
  } catch (err) {
    return { model: GEMINI_MODEL, text: '', durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

async function callClaudeFacts(prompt: string): Promise<FactResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { model: CLAUDE_FACTS_MODEL, text: '', durationMs: 0, error: 'ANTHROPIC_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: CLAUDE_FACTS_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    })
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    return { model: CLAUDE_FACTS_MODEL, text: data.content?.[0]?.text ?? '', durationMs: Date.now() - start }
  } catch (err) {
    return { model: CLAUDE_FACTS_MODEL, text: '', durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
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
  const prompt = nieuwsFeitenPrompt(datum)
  const [chatgpt, claude] = await Promise.all([
    callOpenAISearch(prompt),
    callClaudeFacts(prompt),
  ])

  const results = [chatgpt, claude]
  results.forEach((r) => {
    if (r.error) console.warn(`[FactGathering] ${r.model} nieuws fout: ${r.error}`)
    else console.log(`[FactGathering] ${r.model} nieuws OK (${r.durationMs}ms)`)
  })

  return { results, combined: combineResults(results) }
}

export async function gatherCultuurFacts(datum: string): Promise<GatheredFacts> {
  const prompt = cultuurFeitenPrompt(datum)
  const [chatgpt, claude, gemini] = await Promise.all([
    callOpenAISearch(prompt),
    callClaudeFacts(prompt),
    callGeminiSearch(prompt),
  ])

  const results = [chatgpt, claude, gemini]
  results.forEach((r) => {
    if (r.error) console.warn(`[FactGathering] ${r.model} cultuur fout: ${r.error}`)
    else console.log(`[FactGathering] ${r.model} cultuur OK (${r.durationMs}ms)`)
  })

  return { results, combined: combineResults(results) }
}
