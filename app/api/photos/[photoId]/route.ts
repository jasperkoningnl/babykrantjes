import { NextRequest, NextResponse } from 'next/server'
import { findPaperSession } from '@/lib/paperSession'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: { photoId: string } }) {
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const photoId = context.params.photoId
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 })

  const supabase = getSupabaseAdmin()
  const { data: photo } = await supabase
    .from('paper_photos')
    .select('file_path')
    .eq('id', photoId)
    .eq('paper_id', session.paperId)
    .maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 })

  const { data, error } = await supabase.storage.from('paper-photos').createSignedUrl(photo.file_path, 60)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Foto tijdelijk niet beschikbaar' }, { status: 503 })
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
