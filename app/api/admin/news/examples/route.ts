import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { loadNewsStyleExamples } from '@/lib/newsStyleExamples'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Log opnieuw in' }, { status: 401, headers })
  try { return NextResponse.json({ examples: await loadNewsStyleExamples() }, { headers }) }
  catch { return NextResponse.json({ error: 'Voorbeelden konden niet worden geladen. Probeer opnieuw.' }, { status: 503, headers }) }
}
