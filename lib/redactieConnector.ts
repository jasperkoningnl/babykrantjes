import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from './supabase'
import { amsterdamToday, contentWeekStart, parseCalendarDate } from './contentDates'
import { getLibraryArticle, libraryKey, listLibrary, publishLibraryArticle, type LibrarySource, type LibraryType } from './contentLibrary'

// Remote MCP-server (Streamable HTTP, stateless, JSON-antwoorden) voor de
// Claude-redactietaken. Toegang via een geheime sleutel in de URL; de route
// geeft zonder geldige sleutel een 404.

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const DAY_MS = 86_400_000
const MAX_OVERVIEW_DAYS = 400

export const SERVER_INSTRUCTIONS = `Redactie van Babykrantje. Nieuws: één artikel per dag. Cultuur: één artikel per week (maandag t/m zondag).
Publiceren gaat direct live voor nieuwe kranten; eerdere versies blijven bewaard.
Gebruik [NAAM] waar de roepnaam van de baby moet komen. Lees een bestaand artikel voordat je er een nieuwe versie van publiceert.`

type JsonRpcId = string | number | null
interface JsonRpcMessage { jsonrpc?: string; id?: JsonRpcId; method?: unknown; params?: any }
type JsonRpcResponse = { jsonrpc: '2.0'; id: JsonRpcId } & ({ result: unknown } | { error: { code: number; message: string } })

class ToolInputError extends Error {}

const SOORT = { type: 'string', enum: ['nieuws', 'cultuur'], description: 'nieuws = één artikel per dag; cultuur = één artikel per week (maandag t/m zondag).' }
const DATUM = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'JJJJ-MM-DD. Voor cultuur mag elke dag uit de week; die wordt omgezet naar de maandag.' }

export const TOOLS = [
  {
    name: 'overzicht',
    title: 'Overzicht van de bibliotheek',
    description: 'Laat zien welke dagen (nieuws) of weken (cultuur) gepubliceerd zijn, welke alleen een oud concept hebben en welke ontbreken. Zonder van/tot: de afgelopen 30 dagen. Maximaal 400 dagen per keer.',
    inputSchema: { type: 'object', properties: { soort: SOORT, van: DATUM, tot: DATUM }, required: ['soort'], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'lees_artikel',
    title: 'Artikel lezen',
    description: 'Geeft de gepubliceerde tekst, bronnen en versie van één dag (nieuws) of week (cultuur), plus een eventueel oud, ongepubliceerd concept.',
    inputSchema: { type: 'object', properties: { soort: SOORT, datum: DATUM }, required: ['soort', 'datum'], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'publiceer_artikel',
    title: 'Artikel publiceren',
    description: 'Publiceert een artikel direct. Bestaat er al een versie, dan blijft die bewaard en wordt deze nieuwe versie de actuele.',
    inputSchema: {
      type: 'object',
      properties: {
        soort: SOORT,
        datum: DATUM,
        tekst: { type: 'string', minLength: 1, maxLength: 20000, description: 'Platte tekst zonder Markdown; alinea\'s gescheiden door een lege regel. Gebruik [NAAM] voor de roepnaam van de baby.' },
        bronnen: {
          type: 'array', minItems: 1, maxItems: 30, description: 'De bronnen waar de feiten uit komen.',
          items: { type: 'object', properties: { naam: { type: 'string' }, url: { type: 'string' } }, required: ['naam', 'url'], additionalProperties: false },
        },
        notitie: { type: 'string', maxLength: 1000, description: 'Korte reden van deze versie, bijvoorbeeld "eerste versie" of "Top 40 aangevuld".' },
      },
      required: ['soort', 'datum', 'tekst', 'bronnen'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'stijlvoorbeelden',
    title: 'Stijlvoorbeelden nieuws',
    description: 'Voorbeeldteksten van de redactie voor het nieuwsartikel: toon, onderwerpkeuze en opbouw. Geen feitenbron voor een andere dag.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const

/** Constant-time vergelijking met REDACTIE_SLEUTEL; een te korte of ontbrekende sleutel sluit de connector af. */
export function isValidConnectorKey(provided: string | undefined): boolean {
  const expected = process.env.REDACTIE_SLEUTEL || ''
  if (expected.length < 32 || !provided || provided.length > 256) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(provided), digest(expected))
}

function soort(value: unknown): LibraryType {
  if (value === 'nieuws') return 'news'
  if (value === 'cultuur') return 'culture'
  throw new ToolInputError('soort moet "nieuws" of "cultuur" zijn')
}

function datum(value: unknown, name = 'datum'): string {
  if (typeof value !== 'string' || !parseCalendarDate(value)) throw new ToolInputError(`${name} moet een bestaande datum zijn (JJJJ-MM-DD)`)
  return value
}

function shiftDays(date: string, days: number): string {
  return new Date(parseCalendarDate(date)!.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

function bronnen(value: unknown): LibrarySource[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new ToolInputError('Geef 1 tot 30 bronnen')
  return value.map((bron: any) => {
    const naam = typeof bron?.naam === 'string' ? bron.naam.trim() : ''
    if (!naam || naam.length > 200) throw new ToolInputError('Elke bron heeft een naam van maximaal 200 tekens')
    let url: URL
    try { url = new URL(String(bron?.url ?? '')) } catch { throw new ToolInputError(`Ongeldige bronlink bij "${naam}"`) }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2000) {
      throw new ToolInputError(`Ongeldige bronlink bij "${naam}"`)
    }
    return { name: naam, url: url.toString() }
  })
}

function label(type: LibraryType, key: string) {
  return type === 'culture' ? { soort: 'cultuur', week_van: key, week_tot: shiftDays(key, 6) } : { soort: 'nieuws', datum: key }
}

async function overzicht(args: any) {
  const type = soort(args?.soort)
  const today = amsterdamToday()
  const to = args?.tot === undefined ? today : datum(args.tot, 'tot')
  const from = args?.van === undefined ? shiftDays(to, -30) : datum(args.van, 'van')
  if (from > to) throw new ToolInputError('van ligt na tot')
  if ((parseCalendarDate(to)!.getTime() - parseCalendarDate(from)!.getTime()) / DAY_MS > MAX_OVERVIEW_DAYS) {
    throw new ToolInputError(`Vraag maximaal ${MAX_OVERVIEW_DAYS} dagen per keer op`)
  }
  const firstKey = type === 'culture' ? contentWeekStart(from) : from
  const lastKey = type === 'culture' ? contentWeekStart(to) : to
  const existing = new Map((await listLibrary(type, firstKey, lastKey)).map(item => [item.key, item]))
  const gepubliceerd: { sleutel: string; versie: number; gepubliceerd_op: string }[] = []
  const alleenConcept: string[] = []
  const ontbreekt: string[] = []
  // Niets na vandaag: dat nieuws bestaat nog niet.
  for (let key = firstKey; key <= lastKey && key <= today; key = shiftDays(key, type === 'culture' ? 7 : 1)) {
    const item = existing.get(key)
    if (item?.version && item.published_at) gepubliceerd.push({ sleutel: key, versie: item.version, gepubliceerd_op: item.published_at })
    else if (item?.has_draft) alleenConcept.push(key)
    else ontbreekt.push(key)
  }
  return {
    vandaag: today,
    soort: type === 'culture' ? 'cultuur (sleutel = maandag van de week)' : 'nieuws (sleutel = dag)',
    van: firstKey, tot: lastKey,
    aantallen: { gepubliceerd: gepubliceerd.length, alleen_concept: alleenConcept.length, ontbreekt: ontbreekt.length },
    ontbreekt, alleen_concept: alleenConcept, gepubliceerd,
  }
}

async function leesArtikel(args: any) {
  const type = soort(args?.soort)
  const key = libraryKey(type, datum(args?.datum))
  const article = await getLibraryArticle(type, key)
  return {
    ...label(type, key),
    gepubliceerd: article?.published ? {
      versie: article.published.version, tekst: article.published.body, bronnen: article.published.sources,
      gepubliceerd_op: article.published.published_at, notitie: article.published.note,
    } : null,
    oud_concept: article?.draft ? { tekst: article.draft.body, bronnen: article.draft.sources, bijgewerkt_op: article.draft.updated_at } : null,
  }
}

async function publiceerArtikel(args: any) {
  const type = soort(args?.soort)
  const date = datum(args?.datum)
  const key = libraryKey(type, date)
  if (key > amsterdamToday()) throw new ToolInputError('Deze datum ligt in de toekomst')
  const tekst = typeof args?.tekst === 'string' ? args.tekst.trim() : ''
  if (!tekst || tekst.length > 20000) throw new ToolInputError('tekst is leeg of langer dan 20.000 tekens')
  if (args?.notitie !== undefined && (typeof args.notitie !== 'string' || args.notitie.length > 1000)) {
    throw new ToolInputError('notitie is maximaal 1000 tekens')
  }
  const result = await publishLibraryArticle({ type, date: key, body: tekst, sources: bronnen(args?.bronnen), note: args?.notitie })
  return { gepubliceerd: true, ...label(type, key), versie: result.version }
}

async function stijlvoorbeelden() {
  const { data, error } = await getSupabaseAdmin().from('news_style_examples')
    .select('title,news_date,body,style_note').order('sort_order').limit(10)
  if (error) throw error
  return {
    uitleg: 'Historische voorbeelden van toon, onderwerpkeuze en opbouw. Geen feitenbron: neem geen namen, gebeurtenissen of aantallen over. De persoonlijke openingsalinea is weggelaten.',
    // The curated references keep all family information in the opening paragraph; never share it.
    voorbeelden: (data || []).map(example => ({
      titel: example.title, datum: example.news_date, redactienotitie: example.style_note,
      tekst: String(example.body).split(/\n\s*\n/).slice(1).join('\n\n'),
    })),
  }
}

const HANDLERS: Record<string, (args: any) => Promise<unknown>> = {
  overzicht, lees_artikel: leesArtikel, publiceer_artikel: publiceerArtikel, stijlvoorbeelden,
}

function databaseMessage(error: unknown): string {
  const message = String((error as { message?: string })?.message || error || '')
  if (/future/.test(message)) return 'Deze datum ligt in de toekomst'
  if (/Monday/.test(message)) return 'Een cultuurweek begint op maandag'
  if (/source/i.test(message)) return 'Controleer de bronnen: elke bron heeft een naam en een http(s)-link'
  return `Database: ${message.slice(0, 300) || 'onbekende fout'}`
}

async function callTool(params: any) {
  const handler = typeof params?.name === 'string' && Object.prototype.hasOwnProperty.call(HANDLERS, params.name) ? HANDLERS[params.name] : null
  if (!handler) return null
  try {
    const result = await handler(params.arguments ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false }
  } catch (error) {
    const text = error instanceof ToolInputError ? error.message : databaseMessage(error)
    if (!(error instanceof ToolInputError)) console.error(`[Redactie] ${params.name} mislukt:`, error)
    return { content: [{ type: 'text', text }], isError: true }
  }
}

/** Eén JSON-RPC-bericht; notificaties en antwoorden van de client krijgen geen antwoord (null). */
export async function handleMcpMessage(message: JsonRpcMessage): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = typeof message?.id === 'string' || typeof message?.id === 'number' ? message.id : null
  const reply = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, text: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message: text } })
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') return fail(-32600, 'Invalid Request')
  if (typeof message.method !== 'string') return null
  if (message.id === undefined || message.id === null) return null

  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion
      return reply({
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'babykrantje-redactie', title: 'Babykrantje redactie', version: '1.0.0' },
        instructions: SERVER_INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const result = await callTool(message.params)
      return result ? reply(result) : fail(-32602, `Onbekende tool: ${String(message.params?.name)}`)
    }
    default:
      return fail(-32601, `Method not found: ${message.method}`)
  }
}
