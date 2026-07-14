// lib/newsContext.ts
// @version 1.0.0
// Server-side context voor het nieuwsartikel van de babykrant:
// - Google News koppen van de geboortedatum (daily_google_news)
// - Actieve nieuwsdossiers op de geboortedatum (news_dossiers), gematcht
//   tegen de dagkoppen
//
// Deze data komt uit Supabase (gevuld door de dagelijkse pipeline) en wordt
// bij generatie server-side opgehaald — de frontend hoeft er niets van te
// weten. Zonder Supabase-configuratie of zonder data voor de datum leveren
// de functies lege lijsten op en valt de prompt terug op de overige bronnen.

import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase'

export interface GoogleNewsItem {
  title: string
  topicCategory: string
  sourceName: string | null
}

export interface ActiveDossier {
  name: string
  source: string
  category: string | null
  firstSeenAt: string
  lastSeenAt: string
}

/** Google News koppen die op de gegeven datum zijn gescrapet. */
export async function getGoogleNewsForDate(date: string): Promise<GoogleNewsItem[]> {
  if (!isSupabaseAdminConfigured()) return []
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('daily_google_news')
      .select('title, topic_category, source_name')
      .eq('date', date)
      .limit(60)

    if (error || !data) return []
    return data.map((row) => ({
      title: row.title,
      topicCategory: row.topic_category,
      sourceName: row.source_name,
    }))
  } catch (err) {
    console.error('[NewsContext] Google News leesfout:', err)
    return []
  }
}

/** Dossiers die op de gegeven datum actief waren (first_seen <= datum <= last_seen). */
export async function getActiveDossiersForDate(date: string): Promise<ActiveDossier[]> {
  if (!isSupabaseAdminConfigured()) return []
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('news_dossiers')
      .select('name, source, category, first_seen_at, last_seen_at')
      .lte('first_seen_at', date)
      .gte('last_seen_at', date)
      .limit(500)

    if (error || !data) return []
    return data.map((row) => ({
      name: row.name,
      source: row.source,
      category: row.category,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    }))
  } catch (err) {
    console.error('[NewsContext] Dossiers leesfout:', err)
    return []
  }
}

/** Lowercase en zonder diakrieten, zelfde normalisatie als dossierMatcher. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match gescrapete dossiers (VRT/Al Jazeera namen) tegen de dagkoppen.
 * Een dossier matcht als zijn (genormaliseerde) naam op woordgrens in een
 * kop voorkomt. Dossiers met heel korte namen (< 4 tekens) worden
 * overgeslagen om valse matches te voorkomen.
 */
export function matchDossiersToHeadlines(
  dossiers: ActiveDossier[],
  headlines: string[]
): ActiveDossier[] {
  const normalizedHeadlines = headlines.map(normalize).filter((h) => h.trim().length > 0)
  if (normalizedHeadlines.length === 0) return []

  const matched: ActiveDossier[] = []
  for (const dossier of dossiers) {
    const name = normalize(dossier.name)
    if (name.length < 4) continue

    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'u')
    if (normalizedHeadlines.some((h) => regex.test(h))) {
      matched.push(dossier)
    }
  }
  return matched
}

/**
 * Verrijkt de generatie-data voor de nieuwssectie met Supabase-context:
 * Google News koppen van de geboortedag en dossiers die toen actief waren
 * (gematchte dossiers eerst). Muteert en retourneert hetzelfde data-object.
 * Wordt gebruikt door zowel de per-sectie route als de gecombineerde call.
 */
export async function enrichNewsData(data: any): Promise<any> {
  const geboorteDatum = data?.basisGegevens?.geboorteDatum
  if (!geboorteDatum || !/^\d{4}-\d{2}-\d{2}$/.test(geboorteDatum)) return data

  const [googleNews, allActiveDossiers] = await Promise.all([
    getGoogleNewsForDate(geboorteDatum),
    getActiveDossiersForDate(geboorteDatum),
  ])

  const koppen: string[] = [
    ...(data.dailyNews?.events || []).map((e: any) => String(e?.text ?? '')),
    ...(data.waybackNews?.headlines || []).map((h: any) => String(h?.title ?? '')),
    ...googleNews.map((g) => g.title),
  ]
  const matched = matchDossiersToHeadlines(allActiveDossiers, koppen)
  const matchedNames = new Set(matched.map((d) => d.name))
  const rest = allActiveDossiers.filter((d) => !matchedNames.has(d.name))

  data.googleNews = googleNews
  data.activeDossiers = [...matched, ...rest]
  console.log(`[NewsContext] Nieuws verrijkt: ${googleNews.length} Google News items, ${matched.length}/${allActiveDossiers.length} dossiers gematcht op dagkoppen`)
  return data
}
