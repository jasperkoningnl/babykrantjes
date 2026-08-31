import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase'
import { clearSessionCookie, createSessionForPaper, findPaperSession, setSessionCookie } from '@/lib/paperSession'
import { loadPaperState, validatePaperStateInput } from '@/lib/paperState'

export const dynamic = 'force-dynamic'

function unavailable() {
  return NextResponse.json({ error: 'Opslag is niet geconfigureerd' }, { status: 503 })
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return unavailable()
  const session = await findPaperSession(request)
  if (!session) {
    const response = NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
    clearSessionCookie(response)
    return response
  }
  try {
    return NextResponse.json({ data: await loadPaperState(session.paperId) })
  } catch {
    return NextResponse.json({ error: 'Krant niet gevonden' }, { status: 404 })
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return unavailable()
  try {
    const body = await request.json().catch(() => ({}))
    const initialData = validatePaperStateInput(body?.data || {})
    const basis = (initialData.basisGegevens || {}) as Record<string, unknown>
    const supabase = getSupabaseAdmin()
    const { data: paper, error } = await supabase
      .from('generated_papers')
      .insert({
        baby_name: String(basis.volledigeNaam || '').trim() || null,
        birth_date: /^\d{4}-\d{2}-\d{2}$/.test(String(basis.geboorteDatum || '')) ? String(basis.geboorteDatum) : null,
        birth_time: String(basis.geboorteTijd || '').trim() || null,
        birth_place: String(basis.geboorteplaats || '').trim() || null,
        form_data: initialData,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !paper) throw new Error(error?.message || 'insert mislukt')
    try {
      const { token, session } = await createSessionForPaper(paper.id)
      const response = NextResponse.json({ id: paper.id, data: await loadPaperState(paper.id) }, { status: 201 })
      setSessionCookie(response, token, session.expiresAt)
      return response
    } catch (error) {
      await supabase.from('generated_papers').delete().eq('id', paper.id)
      throw error
    }
  } catch (error) {
    console.error('[Papers] Create fout:', error)
    return NextResponse.json({ error: 'Kon concept-krant niet aanmaken' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return unavailable()
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  try {
    const body = await request.json()
    const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() }
    if (body.data !== undefined) {
      const state = validatePaperStateInput(body.data)
      const basis = (state.basisGegevens || {}) as Record<string, unknown>
      update.form_data = state
      update.baby_name = String(basis.volledigeNaam || '').trim() || null
      update.birth_date = /^\d{4}-\d{2}-\d{2}$/.test(String(basis.geboorteDatum || '')) ? String(basis.geboorteDatum) : null
      update.birth_time = String(basis.geboorteTijd || '').trim() || null
      update.birth_place = String(basis.geboorteplaats || '').trim() || null
    }
    if (body.generatedArticles !== undefined) update.generated_articles = validatePaperStateInput(body.generatedArticles)
    if (body.manualEdits !== undefined) update.manual_edits = validatePaperStateInput(body.manualEdits)
    if (body.contactEmail !== undefined) {
      const email = String(body.contactEmail).trim().toLowerCase()
      if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)) {
        return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
      }
      update.contact_email = email || null
    }
    const { error } = await getSupabaseAdmin().from('generated_papers').update(update).eq('id', session.paperId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Papers] Update fout:', error)
    return NextResponse.json({ error: 'Kon krant niet bewaren' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return unavailable()
  const session = await findPaperSession(request)
  if (!session) return NextResponse.json({ error: 'Geen geldige krantsessie' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const { data: photos } = await supabase.from('paper_photos').select('file_path').eq('paper_id', session.paperId)
  const paths = (photos || []).map((photo) => photo.file_path)
  if (paths.length) await supabase.storage.from('paper-photos').remove(paths)
  const { error } = await supabase.from('generated_papers').delete().eq('id', session.paperId)
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
