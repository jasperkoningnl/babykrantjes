import { NextRequest, NextResponse } from 'next/server'
import { findPaperSession } from '@/lib/paperSession'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function publicJob(job: any) {
  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    error: job.status === 'failed' ? (job.last_error || 'Generatie mislukt') : null,
    updatedAt: job.updated_at,
  }
}

export async function GET(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const { data, error } = await getSupabaseAdmin().from('paper_generation_jobs')
    .select('id,status,attempts,max_attempts,last_error,updated_at')
    .eq('paper_id', session.paperId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Jobstatus niet beschikbaar' }, { status: 503 })
  return NextResponse.json({ job: data ? publicJob(data) : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const { data, error } = await getSupabaseAdmin().rpc('enqueue_paper_generation', {
    p_paper_id: session.paperId,
    p_idempotency_key: `paper:${session.paperId}:generation:v1`,
  })
  if (error || !data?.[0]) return NextResponse.json({ error: 'Generatie kon niet worden ingepland' }, { status: 503 })
  return NextResponse.json({ job: publicJob(data[0]) }, { status: data[0].status === 'completed' ? 200 : 202 })
}
