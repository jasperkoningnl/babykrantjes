// lib/claude.ts
// @version 1.0.0
// Gedeelde Claude API-aanroepen voor artikelgeneratie (alleen server-side).

import { CLAUDE_MODEL } from './prompts'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION_HEADER = '2023-06-01'

export interface TokensUsed {
  input: number
  output: number
}

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ontbreekt')
  return apiKey
}

async function postMessages(body: Record<string, unknown>): Promise<any> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': API_VERSION_HEADER,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Claude] API error response:', errorText)
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/** Eén sectie als platte tekst (voor per-sectie generatie/regeneratie). */
export async function callClaude(
  prompt: string,
  systemPrompt: string
): Promise<{ text: string; tokensUsed: TokensUsed }> {
  const result = await postMessages({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  return {
    text: result.content?.[0]?.text || '',
    tokensUsed: {
      input: result.usage?.input_tokens || 0,
      output: result.usage?.output_tokens || 0,
    },
  }
}

/**
 * Gestructureerde output via forced tool use: Claude moet de opgegeven tool
 * aanroepen, waardoor het resultaat gegarandeerd het JSON-schema volgt.
 */
export async function callClaudeStructured<T>(
  prompt: string,
  systemPrompt: string,
  tool: { name: string; description: string; input_schema: Record<string, unknown> },
  maxTokens = 8000
): Promise<{ data: T; tokensUsed: TokensUsed }> {
  const result = await postMessages({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  })

  const toolUse = (result.content || []).find(
    (block: any) => block?.type === 'tool_use' && block?.name === tool.name
  )
  if (!toolUse?.input) {
    throw new Error('Claude gaf geen gestructureerd resultaat terug')
  }

  return {
    data: toolUse.input as T,
    tokensUsed: {
      input: result.usage?.input_tokens || 0,
      output: result.usage?.output_tokens || 0,
    },
  }
}
