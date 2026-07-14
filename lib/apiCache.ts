// lib/apiCache.ts
// @version 1.0.0
// Supabase cache-on-read laag voor de bestaande API routes.
//
// Patroon per route:
//   1. Check de api_cache tabel op cache_key
//   2. Miss: on-the-fly ophalen (bestaande logica)
//   3. Succesvol resultaat terugschrijven naar de cache
//
// Als Supabase niet geconfigureerd is (bijv. lokale dev zonder env vars)
// werkt alles gewoon zonder cache — de fetcher draait dan altijd.

import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase'

export interface CacheResult<T> {
  data: T
  fromCache: boolean
}

/**
 * Generieke cache-on-read wrapper rond een fetcher.
 *
 * @param endpoint   logische naam ('weather', 'tmdb', 'news_daily', ...)
 * @param key        unieke sleutel binnen het endpoint (bijv. de datum + params)
 * @param date       de opgevraagde datum (voor rapportage/opruimen), optioneel
 * @param fetcher    de bestaande on-the-fly logica
 * @param shouldCache bepaalt of een vers resultaat de cache in mag
 *                   (default: altijd) — gebruik dit om lege/fout-resultaten
 *                   niet te bevriezen
 */
export async function withApiCache<T>(options: {
  endpoint: string
  key: string
  date?: string | null
  fetcher: () => Promise<T>
  shouldCache?: (data: T) => boolean
}): Promise<CacheResult<T>> {
  const { endpoint, key, date, fetcher, shouldCache } = options
  const cacheKey = `${endpoint}:${key}`

  if (!isSupabaseAdminConfigured()) {
    return { data: await fetcher(), fromCache: false }
  }

  const supabase = getSupabaseAdmin()

  // 1. Cache check — een cache-fout mag de request nooit laten falen
  try {
    const { data: cached, error } = await supabase
      .from('api_cache')
      .select('payload')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (!error && cached?.payload !== undefined && cached?.payload !== null) {
      return { data: cached.payload as T, fromCache: true }
    }
  } catch (err) {
    console.error(`[ApiCache] Leesfout voor ${cacheKey}:`, err)
  }

  // 2. On-the-fly ophalen
  const fresh = await fetcher()

  // 3. Terugschrijven
  const cacheable = shouldCache ? shouldCache(fresh) : true
  if (cacheable) {
    try {
      const { error } = await supabase.from('api_cache').upsert(
        {
          cache_key: cacheKey,
          endpoint,
          date: date ?? null,
          payload: fresh,
        },
        { onConflict: 'cache_key' }
      )
      if (error) console.error(`[ApiCache] Schrijffout voor ${cacheKey}:`, error.message)
    } catch (err) {
      console.error(`[ApiCache] Schrijffout voor ${cacheKey}:`, err)
    }
  }

  return { data: fresh, fromCache: false }
}
