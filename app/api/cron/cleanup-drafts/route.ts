import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: expiredPhotos } = await supabase.from('paper_photos').select('id, file_path').lt('expires_at', now).limit(1000)
  if (expiredPhotos?.length) {
    await supabase.storage.from('paper-photos').remove(expiredPhotos.map((photo) => photo.file_path))
    await supabase.from('paper_photos').delete().in('id', expiredPhotos.map((photo) => photo.id))
  }

  const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: candidates, error } = await supabase.rpc('abandoned_paper_ids', { p_before: before })
  if (error) return NextResponse.json({ error: 'Opruimen mislukt' }, { status: 500 })

  let removed = 0
  for (const candidate of candidates || []) {
    const { data: photos } = await supabase.from('paper_photos').select('file_path').eq('paper_id', candidate.paper_id)
    if (photos?.length) await supabase.storage.from('paper-photos').remove(photos.map((photo) => photo.file_path))
    const { error: deleteError } = await supabase.from('generated_papers').delete().eq('id', candidate.paper_id).eq('status', 'draft')
    if (!deleteError) removed += 1
  }
  return NextResponse.json({ removedDrafts: removed, removedExpiredPhotos: expiredPhotos?.length || 0 })
}
