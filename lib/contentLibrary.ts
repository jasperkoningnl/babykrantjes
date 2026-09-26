import 'server-only'

import { getSupabaseAdmin } from './supabase'
import { contentWeekStart, parseCalendarDate } from './contentDates'

// Gedeelde artikelen: nieuws per dag, cultuur per week (maandag).
// Geschreven en gepubliceerd door de Claude-redactietaken via de redactie-connector.
export type LibraryType = 'news' | 'culture'

export interface LibrarySource { name: string; url: string }

export interface LibraryArticle {
  article_id: string
  published: { revision_id: string; version: number; body: string; sources: LibrarySource[]; published_at: string; note: string | null } | null
  draft: { body: string; sources: LibrarySource[]; updated_at: string } | null
}

export interface LibraryOverviewItem { key: string; version: number | null; published_at: string | null; has_draft: boolean }

/** De sleutel waaronder een datum is opgeslagen: de dag zelf, of voor cultuur de maandag van die week. */
export function libraryKey(type: LibraryType, date: string): string {
  if (!parseCalendarDate(date)) throw new Error('Ongeldige datum')
  return type === 'culture' ? contentWeekStart(date) : date
}

export async function getLibraryArticle(type: LibraryType, date: string): Promise<LibraryArticle | null> {
  const { data, error } = await getSupabaseAdmin().rpc('library_article', { p_type: type, p_key: libraryKey(type, date) })
  if (error) throw error
  return (data as LibraryArticle | null) ?? null
}

/** Alleen gepubliceerde tekst; een oud concept of een onbruikbare datum levert niets op. */
export async function getPublishedText(type: LibraryType, date: string): Promise<string | null> {
  if (!parseCalendarDate(date)) return null
  return (await getLibraryArticle(type, date))?.published?.body ?? null
}

export async function listLibrary(type: LibraryType, from: string, to: string): Promise<LibraryOverviewItem[]> {
  const { data, error } = await getSupabaseAdmin().rpc('library_overview', { p_type: type, p_from: from, p_to: to })
  if (error) throw error
  return (data as LibraryOverviewItem[]) ?? []
}

export async function publishLibraryArticle(input: {
  type: LibraryType; date: string; body: string; sources: LibrarySource[]; note?: string
}): Promise<{ article_id: string; revision_id: string; version: number }> {
  const { data, error } = await getSupabaseAdmin().rpc('publish_library_article', {
    p_type: input.type, p_key: libraryKey(input.type, input.date), p_body: input.body,
    p_sources: input.sources, p_note: input.note ?? null,
  })
  if (error) throw error
  return data as { article_id: string; revision_id: string; version: number }
}

/** Gedeelde teksten gebruiken [NAAM]; de krant vult de roepnaam in. */
export function fillName(text: string, roepnaam: string): string {
  return text.replaceAll('[NAAM]', roepnaam)
}
