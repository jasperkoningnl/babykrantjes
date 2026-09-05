import { NextRequest, NextResponse } from 'next/server'
import { findPaperSession } from '@/lib/paperSession'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const limit = await checkRateLimit(request, 'paper')
  if (!limit.allowed) return NextResponse.json({ error: 'Opnieuw proberen is tijdelijk niet beschikbaar' }, { status: limit.unavailable ? 503 : 429 })
  const { data, error } = await getSupabaseAdmin().rpc('retry_paper_generation_job', { p_paper_id: session.paperId })
  if (error) return NextResponse.json({ error: 'Opnieuw proberen mislukt' }, { status: 503 })
  if (!data?.[0]) return NextResponse.json({ error: 'Alleen een permanent mislukte job kan opnieuw worden gestart' }, { status: 409 })
  return NextResponse.json({ job: { id: data[0].id, status: data[0].status } }, { status: 202 })
}
