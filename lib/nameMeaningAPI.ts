// lib/nameMeaningAPI.ts
// @version 1.1.0
// Client-side wrapper voor naambetekenis API
// Roept de server-side API route aan om CORS problemen te vermijden

export interface NameMeaningData {
  firstName: string
  meaning: string | null
  origin: string | null
  gender: string | null
  source: string | null
}

/**
 * Haalt naambetekenis op via de server-side API route
 * @param fullName - Volledige naam (alleen eerste voornaam wordt gebruikt)
 */
export async function getNameMeaning(fullName: string): Promise<NameMeaningData> {
  const emptyResult: NameMeaningData = {
    firstName: extractFirstName(fullName),
    meaning: null,
    origin: null,
    gender: null,
    source: null
  }

  if (!fullName || fullName.trim() === '') {
    return emptyResult
  }

  try {
    const response = await fetch(`/api/name-meaning?name=${encodeURIComponent(fullName)}`)
    
    if (!response.ok) {
      console.error(`[NameMeaning] API error: ${response.status}`)
      return emptyResult
    }

    const data = await response.json()
    return data as NameMeaningData

  } catch (error) {
    console.error('[NameMeaning] Error:', error)
    return emptyResult
  }
}

/**
 * Extraheert de eerste voornaam uit een volledige naam
 */
function extractFirstName(fullName: string): string {
  if (!fullName || fullName.trim() === '') return ''
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 0 ? parts[0] : ''
}