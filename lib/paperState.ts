import 'server-only'

import { getSupabaseAdmin } from './supabase'

const MAX_STATE_BYTES = 64 * 1024
const MAX_TEXT_LENGTH = 2000

export function validatePaperStateInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Ongeldige krantdata')
  }
  const serialized = JSON.stringify(value)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) {
    throw new Error('Krantdata is te groot')
  }
  walkStrings(value, 0)
  return value as Record<string, unknown>
}

function walkStrings(value: unknown, depth: number): void {
  if (depth > 8) throw new Error('Krantdata is te diep genest')
  if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
    throw new Error('Een invoerveld is te lang')
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw new Error('Te veel waarden')
    for (const item of value) walkStrings(item, depth + 1)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) walkStrings(item, depth + 1)
  }
}

export async function loadPaperState(paperId: string) {
  const supabase = getSupabaseAdmin()
  const [{ data: paper, error }, { data: photos }] = await Promise.all([
    supabase
      .from('generated_papers')
      .select('id, form_data, generated_articles, manual_edits, contact_email, status, expires_at')
      .eq('id', paperId)
      .single(),
    supabase
      .from('paper_photos')
      .select('id, position')
      .eq('paper_id', paperId)
      .order('position'),
  ])
  if (error || !paper) throw new Error('Krant niet gevonden')

  const formData = (paper.form_data || {}) as Record<string, any>
  const fotoState: Record<string, unknown> = { foto1: null, foto2: null, foto3: null, foto4: null }
  for (const photo of photos || []) {
    if (photo.position >= 1 && photo.position <= 4) {
      fotoState[`foto${photo.position}`] = {
        photoId: photo.id,
        url: `/api/photos/${encodeURIComponent(photo.id)}`,
      }
    }
  }

  return {
    ...formData,
    paperId: paper.id,
    fotos: fotoState,
    generatedArticles: paper.generated_articles || undefined,
    manualEdits: paper.manual_edits || {},
    contactEmail: paper.contact_email || '',
    status: paper.status,
    expiresAt: paper.expires_at,
  }
}
