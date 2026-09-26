import { NextRequest, NextResponse } from 'next/server'
import { handleMcpMessage, isValidConnectorKey } from '@/lib/redactieConnector'

// MCP-connector voor de Claude-redactietaken (zie docs/redactie.md).
// Voeg in Claude toe als custom connector: https://<site>/api/redactie/<REDACTIE_SLEUTEL>
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 256 * 1024
const headers = { 'Cache-Control': 'no-store' }
type Context = { params: Promise<{ sleutel: string }> }

async function authorized(context: Context) {
  return isValidConnectorKey((await context.params).sleutel)
}

export async function POST(request: NextRequest, context: Context) {
  if (!await authorized(context)) return new NextResponse(null, { status: 404, headers })
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large' } }, { status: 413, headers })
  }
  let body: unknown
  try { body = JSON.parse(raw) } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers })
  }
  const batch = Array.isArray(body)
  const messages = batch ? body as any[] : [body as any]
  if (!messages.length || messages.length > 20) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } }, { status: 400, headers })
  }
  const responses = (await Promise.all(messages.map(handleMcpMessage))).filter(Boolean)
  // Only notifications or client responses: accepted, no body.
  if (!responses.length) return new NextResponse(null, { status: 202, headers })
  return NextResponse.json(batch ? responses : responses[0], { headers })
}

// Stateless server: no server-initiated stream and no sessions to end.
async function notAllowed(context: Context) {
  if (!await authorized(context)) return new NextResponse(null, { status: 404, headers })
  return new NextResponse(null, { status: 405, headers: { ...headers, Allow: 'POST' } })
}

export async function GET(_request: NextRequest, context: Context) {
  return notAllowed(context)
}

export async function DELETE(_request: NextRequest, context: Context) {
  return notAllowed(context)
}
