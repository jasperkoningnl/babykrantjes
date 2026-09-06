// lib/factGathering.ts
// Feitenverzameling via AI-modellen met websearch voor de nieuws- en cultuursecties.
//
// Nieuws: GPT-5.4 + Sonnet 4.6, beide met websearch → feiten combineren
// Cultuur: ChatGPT (web search) + Claude (kennis) + Gemini (Google Search) → feiten combineren

const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-3.6-flash'
const CLAUDE_FACTS_MODEL = 'claude-haiku-4-5'
const NEWS_OPENAI_MODEL = 'gpt-5.4-2026-03-05'
const NEWS_CLAUDE_MODEL = 'claude-sonnet-4-6'

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
  return `Zoek het nieuws op van ${datum}. Geef een feitelijke opsomming van 6-8 nieuwsitems die op of rond deze dag speelden, met voor elk item: wat er gebeurde, wanneer, en waarom het relevant is. Mix Nederlands en internationaal nieuws. Noem ook grote lopende verhaallijnen die het nieuws in die periode domineerden, met een concreet feit van die dag als aanleiding. Noem ook grote evenementen, festivals of sportevenementen die op deze dag plaatsvonden of van start gingen, als die relevant genoeg zijn. Geef alleen verifieerbare feiten, geen interpretaties. Antwoord in het Nederlands.`
}

function cultuurFeitenPrompt(datum: string): string {
  return `Zoek op wat er op cultureel gebied speelde rond ${datum} in Nederland. Geef een feitelijke opsomming van: (1) de nummer 1 in de Nederlandse Top 40, (2) andere populaire muziek, (3) de grote bioscoopfilms in Nederland, (4) trending series op Netflix, Apple TV+, Disney+, Prime Video en andere streamingdiensten, (5) opvallende TV-programma's op de Nederlandse televisie. Raadpleeg Top40.nl, Filmvandaag.nl, VPRO Cinema, en trending lijsten van streamingdiensten. Geef alleen verifieerbare feiten, geen waardeoordelen. Antwoord in het Nederlands.`
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function callOpenAISearch(prompt: string, bounded = false, news = false): Promise<FactResult> {
  const model = news ? NEWS_OPENAI_MODEL : OPENAI_MODEL
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { model, text: '', durationMs: 0, error: 'OPENAI_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, tools: [{ type: news ? 'web_search' : 'web_search_preview' }], input: prompt,
        ...(news ? { reasoning: { effort: 'low' } } : {}),
        ...(bounded || news ? { max_output_tokens: 4000, max_tool_calls: 2, store: false } : {}) }),
      signal: AbortSignal.timeout(news ? 60000 : 45000),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    if ((bounded || news) && data.status !== 'completed') throw new Error('Incomplete research')
    const text = (data.output ?? [])
      .filter((item: any) => item.type === 'message')
      .flatMap((item: any) => (item.content ?? []))
      .filter((c: any) => c.type === 'output_text')
      .map((c: any) => c.text)
      .join('\n')

    const sources = (data.output ?? []).flatMap((item: any) => item.content ?? [])
      .flatMap((part: any) => part.annotations ?? [])
      .filter((a: any) => a.type === 'url_citation' && /^https?:\/\//.test(a.url))
      .map((a: any) => ({ name: a.title || a.url, url: a.url }))
    if (news && !sources.length) throw new Error('Research has no web citations')
    return { model, text, sources, usage: data.usage, durationMs: Date.now() - start }
  } catch (err) {
    return { model, text: '', durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
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

async function callClaudeFacts(prompt: string, news = false): Promise<FactResult> {
  const model = news ? NEWS_CLAUDE_MODEL : CLAUDE_FACTS_MODEL
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { model, text: '', durationMs: 0, error: 'ANTHROPIC_API_KEY ontbreekt' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: news ? 3000 : 1500,
        ...(news ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
          system: 'Gebruik websearch voor de nieuwsfeiten en citeer de geraadpleegde bronnen. Maximaal twee zoekopdrachten. Maak onderscheid tussen de gebeurtenisdatum en publicatiedatum. Noem geen onbevestigde feiten.' } : {}),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(news ? 60000 : 45000),
    })
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`)

    const data = await res.json() as any
    if (data.stop_reason === 'max_tokens') throw new Error('Incomplete research')
    if (news && data.stop_reason !== 'end_turn') throw new Error('Research paused or incomplete')
    const blocks = (data.content || []).filter((b: any) => b.type === 'text')
    const text = blocks.map((b: any) => b.text).join('\n')
    const sources = blocks.flatMap((b: any) => b.citations || [])
      .filter((c: any) => c.type === 'web_search_result_location' && /^https?:\/\//.test(c.url))
      .map((c: any) => ({ name: c.title || c.url, url: c.url }))
    if (news && !sources.length) throw new Error('Research has no web citations')
    return { model, text, sources, usage: data.usage, durationMs: Date.now() - start }
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

export async function gatherNewsFacts(datum: string, bounded = false): Promise<GatheredFacts> {
  const prompt = nieuwsFeitenPrompt(datum)
  const [chatgpt, claude] = await Promise.all([
    callOpenAISearch(prompt, bounded, true),
    callClaudeFacts(prompt, true),
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
