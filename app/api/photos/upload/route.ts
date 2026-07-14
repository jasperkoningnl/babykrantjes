// app/api/photos/upload/route.ts
// @version 1.0.0
// Foto-upload naar Vercel Blob Storage, direct vanuit stap 3 van de wizard.
// - POST: multipart/form-data met 'file', optioneel 'paperId' en 'position'
//         → uploadt naar Blob en registreert in paper_photos (indien paperId)
// - DELETE: JSON body { url, photoId? } → verwijdert uit Blob en paper_photos
//
// Vereist env var BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob).

import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB, zelfde limiet als de wizard-UI
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export async function POST(request: NextRequest) {
  if (!blobConfigured()) {
    return NextResponse.json(
      { error: 'Foto-opslag is niet geconfigureerd (BLOB_READ_WRITE_TOKEN ontbreekt)' },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const paperId = String(formData.get('paperId') || '').trim() || null
    const positionRaw = parseInt(String(formData.get('position') || ''), 10)
    const position = Number.isFinite(positionRaw) && positionRaw >= 1 && positionRaw <= 4 ? positionRaw : null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Geen bestand meegestuurd (veld: file)' }, { status: 400 })
    }

    const extension = ALLOWED_TYPES[file.type]
    if (!extension) {
      return NextResponse.json(
        { error: `Bestandstype ${file.type || 'onbekend'} niet toegestaan (JPG, PNG of WebP)` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Bestand is groter dan 10MB' }, { status: 400 })
    }

    const pathname = `papers/${paperId ?? 'ongekoppeld'}/foto-${position ?? 'x'}.${extension}`
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })

    // Registreer in paper_photos zodra er een krant-record is om aan te koppelen
    let photoId: string | null = null
    if (paperId && isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdmin()

      // Eén foto per positie: vervang een eerdere upload op dezelfde plek
      if (position !== null) {
        const { data: existing } = await supabase
          .from('paper_photos')
          .select('id, file_path')
          .eq('paper_id', paperId)
          .eq('position', position)

        for (const row of existing ?? []) {
          await supabase.from('paper_photos').delete().eq('id', row.id)
          try {
            await del(row.file_path)
          } catch (err) {
            console.error('[Photos] Kon oude blob niet verwijderen:', err)
          }
        }
      }

      const { data, error } = await supabase
        .from('paper_photos')
        .insert({ paper_id: paperId, file_path: blob.url, position })
        .select('id')
        .single()

      if (error) {
        console.error('[Photos] paper_photos insert fout:', error.message)
      } else {
        photoId = data.id
      }
    }

    return NextResponse.json({ url: blob.url, photoId })
  } catch (err) {
    console.error('[Photos] Upload fout:', err)
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!blobConfigured()) {
    return NextResponse.json(
      { error: 'Foto-opslag is niet geconfigureerd (BLOB_READ_WRITE_TOKEN ontbreekt)' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const url = String(body?.url || '').trim()
    const photoId = String(body?.photoId || '').trim() || null

    if (!url) {
      return NextResponse.json({ error: 'url is verplicht' }, { status: 400 })
    }

    await del(url)

    if (photoId && isSupabaseAdminConfigured()) {
      const { error } = await getSupabaseAdmin().from('paper_photos').delete().eq('id', photoId)
      if (error) console.error('[Photos] paper_photos delete fout:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Photos] Delete fout:', err)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
