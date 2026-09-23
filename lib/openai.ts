// lib/openai.ts
// Gedeelde OpenAI-aanroepen (Responses API) voor onderzoek en artikelgeneratie.
// Alleen server-side.

const API_URL = 'https://api.openai.com/v1/responses'
const MAX_INPUT_BYTES = 100 * 1024

/** Schrijfmodel voor alle krantteksten; instelbaar zonder codewijziging. */
export function writerModel(): string {
  return process.env.OPENAI_WRITER_MODEL || 'gpt-5.4-mini'
}

/** Schrijfmodel voor het nieuwsartikel (redactieconcept en losse sectie); standaard gelijk aan het schrijfmodel. */
export function newsWriterModel(): string {
  return process.env.OPENAI_NEWS_WRITER_MODEL || writerModel()
}

/** Onderzoeksmodel met websearch voor nieuws en cultuur. */
export function researchModel(): string {
  return process.env.OPENAI_RESEARCH_MODEL || 'gpt-5.4-2026-03-05'
}

/** Prijs van het standaard schrijfmodel (gpt-5.4-mini), in dollars per 1M tokens. */
export const OPENAI_PRICING = {
  inputCostPer1MTokens: 0.75,
  outputCostPer1MTokens: 4.50,
}

export interface TokensUsed {
  input: number
  output: number
}

export interface Source {
  name: string
  url: string
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY ontbreekt')
  return apiKey
}

/** POST naar de Responses API; alleen een volledig afgerond antwoord telt. */
export async function postResponses(body: Record<string, unknown>, timeoutMs = 45_000): Promise<any> {
  const serialized = JSON.stringify({ store: false, ...body })
  if (Buffer.byteLength(serialized, 'utf8') > MAX_INPUT_BYTES) {
    throw new Error('AI-invoer is te groot')
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getApiKey()}` },
    body: serialized,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[OpenAI] API error response:', errorText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  const data = await response.json()
  if (data?.status !== 'completed') throw new Error('OpenAI-antwoord is niet volledig')
  return data
}

function outputParts(data: any): any[] {
  return (data?.output ?? [])
    .filter((item: any) => item?.type === 'message')
    .flatMap((item: any) => item.content ?? [])
}

export function outputText(data: any): string {
  return outputParts(data)
    .filter((part: any) => part?.type === 'output_text')
    .map((part: any) => part.text)
    .join('\n')
}

/** Webbronnen die het model in zijn antwoord citeert, zonder dubbele URL's. */
export function urlCitations(data: any): Source[] {
  const sources = outputParts(data)
    .flatMap((part: any) => part?.annotations ?? [])
    .filter((a: any) => a?.type === 'url_citation' && typeof a.url === 'string' && /^https?:\/\//.test(a.url))
    .map((a: any) => ({ name: a.title || a.url, url: a.url }))
  return Array.from(new Map(sources.map((s: Source) => [s.url, s])).values())
}

function tokensUsed(data: any): TokensUsed {
  return { input: data?.usage?.input_tokens || 0, output: data?.usage?.output_tokens || 0 }
}

/** Eén tekst (per-sectie generatie, redactieconcept). */
export async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  options: { maxOutputTokens?: number; model?: string } = {}
): Promise<{ text: string; tokensUsed: TokensUsed; usage: unknown; model: string }> {
  const model = options.model || writerModel()
  const data = await postResponses({
    model,
    instructions: systemPrompt,
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: options.maxOutputTokens ?? 2000,
  })
  return { text: outputText(data).trim(), tokensUsed: tokensUsed(data), usage: data.usage, model }
}

/**
 * Gestructureerde output: het antwoord moet exact het JSON-schema volgen
 * (strict json_schema), waarna het hier nog eens geparsed wordt.
 */
export async function callOpenAIStructured<T>(
  prompt: string,
  systemPrompt: string,
  format: { name: string; schema: Record<string, unknown> },
  maxOutputTokens = 8000
): Promise<{ data: T; tokensUsed: TokensUsed }> {
  const result = await postResponses({
    model: writerModel(),
    instructions: systemPrompt,
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: maxOutputTokens,
    text: { format: { type: 'json_schema', name: format.name, strict: true, schema: format.schema } },
  }, 55_000) // Onderzoek (max 60 s) + schrijven moet binnen maxDuration 120 s passen.
  let parsed: unknown
  try {
    parsed = JSON.parse(outputText(result))
  } catch {
    throw new Error('OpenAI gaf geen geldig gestructureerd resultaat terug')
  }
  const required = (format.schema.required as string[] | undefined) ?? []
  if (!parsed || typeof parsed !== 'object' || required.some((key) => typeof (parsed as any)[key] !== 'string')) {
    throw new Error('OpenAI gaf geen volledig gestructureerd resultaat terug')
  }
  return { data: parsed as T, tokensUsed: tokensUsed(result) }
}

/** Onderzoek met websearch; zonder webbronnen is het resultaat ongeldig. */
export async function callOpenAIResearch(
  prompt: string,
  options: { maxToolCalls?: number; maxOutputTokens?: number; timeoutMs?: number } = {}
): Promise<{ text: string; sources: Source[]; usage: unknown; model: string }> {
  const model = researchModel()
  const data = await postResponses({
    model,
    tools: [{ type: 'web_search' }],
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: options.maxOutputTokens ?? 4000,
    max_tool_calls: options.maxToolCalls ?? 2,
  }, options.timeoutMs ?? 60_000)
  const sources = urlCitations(data)
  if (!sources.length) throw new Error('Research has no web citations')
  return { text: outputText(data), sources, usage: data.usage, model }
}
