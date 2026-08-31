import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { findPaperSession } from '@/lib/paperSession'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase'

export const runtime = 'nodejs'
const MAX_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 12_000
const MAX_PIXELS = 40_000_000
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: 'Foto-opslag is niet geconfigureerd' }, { status: 503 })
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const position = Number.parseInt(String(formData.get('position') || ''), 10)
    if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand meegestuurd' }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: 'Afbeelding mag maximaal 10MB zijn' }, { status: 400 })
    if (!Number.isInteger(position) || position < 1 || position > 4) return NextResponse.json({ error: 'Ongeldige fotopositie' }, { status: 400 })

    const source = Buffer.from(await file.arrayBuffer())
    const image = sharp(source, { failOn: 'error', limitInputPixels: MAX_PIXELS })
    const metadata = await image.metadata()
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
      return NextResponse.json({ error: 'Bestandsinhoud is geen toegestane afbeelding' }, { status: 400 })
    }
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || metadata.width * metadata.height > MAX_PIXELS) {
      return NextResponse.json({ error: 'Afbeeldingsafmetingen zijn te groot' }, { status: 400 })
    }

    const encoded = await image.rotate().resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
    const objectPath = `${session.paperId}/${randomUUID()}.webp`
    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage.from('paper-photos').upload(objectPath, encoded.data, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { data: existing } = await supabase.from('paper_photos').select('id, file_path').eq('paper_id', session.paperId).eq('position', position)
    const { data: photo, error: insertError } = await supabase
      .from('paper_photos')
      .insert({
        paper_id: session.paperId,
        file_path: objectPath,
        position,
        mime_type: 'image/webp',
        byte_size: encoded.data.length,
        width: encoded.info.width,
        height: encoded.info.height,
      })
      .select('id')
      .single()
    if (insertError || !photo) {
      await supabase.storage.from('paper-photos').remove([objectPath])
      throw insertError || new Error('Foto kon niet worden geregistreerd')
    }

    for (const old of existing || []) {
      await supabase.storage.from('paper-photos').remove([old.file_path])
      await supabase.from('paper_photos').delete().eq('id', old.id).eq('paper_id', session.paperId)
    }
    return NextResponse.json({ photoId: photo.id, url: `/api/photos/${encodeURIComponent(photo.id)}` })
  } catch (error) {
    console.error('[Photos] Upload fout:', error)
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: 'Foto-opslag is niet geconfigureerd' }, { status: 503 })
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const photoId = String((await request.json().catch(() => ({})))?.photoId || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return NextResponse.json({ error: 'photoId is verplicht' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: photo } = await supabase.from('paper_photos').select('id, file_path').eq('id', photoId).eq('paper_id', session.paperId).maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 })
  const { error: storageError } = await supabase.storage.from('paper-photos').remove([photo.file_path])
  if (storageError) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  const { error } = await supabase.from('paper_photos').delete().eq('id', photo.id).eq('paper_id', session.paperId)
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
