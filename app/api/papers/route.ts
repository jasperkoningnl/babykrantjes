// app/api/papers/route.ts
// @version 1.0.0
// Maakt een concept-babykrant (generated_papers) aan in Supabase.
// De wizard roept dit één keer aan (bij de eerste foto-upload) zodat
// foto's via paper_photos aan de krant gekoppeld kunnen worden.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    // Zonder Supabase kan de wizard gewoon door; foto's worden dan alleen
    // in Blob opgeslagen zonder databasekoppeling.
    return NextResponse.json({ id: null, warning: 'Supabase niet geconfigureerd' })
  }

  try {
    const body = await request.json()
    const basisGegevens = body?.basisGegevens
    const extraVragen = body?.extraVragen

    const babyName = String(basisGegevens?.volledigeNaam || '').trim()
    const birthDate = String(basisGegevens?.geboorteDatum || '').trim()

    if (!babyName || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return NextResponse.json(
        { error: 'volledigeNaam en geboorteDatum (YYYY-MM-DD) zijn verplicht' },
        { status: 400 }
      )
    }

    const { data, error } = await getSupabaseAdmin()
      .from('generated_papers')
      .insert({
        baby_name: babyName,
        birth_date: birthDate,
        birth_time: basisGegevens?.geboorteTijd || null,
        birth_place: basisGegevens?.geboorteplaats || null,
        form_data: { basisGegevens, extraVragen },
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Papers] Insert fout:', error.message)
      return NextResponse.json({ error: 'Kon concept-krant niet aanmaken' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[Papers] Fout:', err)
    return NextResponse.json({ error: 'Ongeldige request' }, { status: 400 })
  }
}
