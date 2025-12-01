// Nederlandse steden met coördinaten voor weerbericht ophalen

export interface CityCoordinates {
  name: string
  lat: number
  lon: number
}

export const DUTCH_CITIES: CityCoordinates[] = [
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'Rotterdam', lat: 51.9244, lon: 4.4777 },
  { name: 'Den Haag', lat: 52.0705, lon: 4.3007 },
  { name: "'s-Gravenhage", lat: 52.0705, lon: 4.3007 },
  { name: 'Utrecht', lat: 52.0907, lon: 5.1214 },
  { name: 'Eindhoven', lat: 51.4416, lon: 5.4697 },
  { name: 'Groningen', lat: 53.2194, lon: 6.5665 },
  { name: 'Tilburg', lat: 51.5555, lon: 5.0913 },
  { name: 'Almere', lat: 52.3508, lon: 5.2647 },
  { name: 'Breda', lat: 51.5719, lon: 4.7683 },
  { name: 'Nijmegen', lat: 51.8126, lon: 5.8372 },
  { name: 'Enschede', lat: 52.2185, lon: 6.8937 },
  { name: 'Apeldoorn', lat: 52.2112, lon: 5.9699 },
  { name: 'Haarlem', lat: 52.3874, lon: 4.6462 },
  { name: 'Arnhem', lat: 51.9851, lon: 5.8987 },
  { name: 'Zaanstad', lat: 52.4389, lon: 4.8258 },
  { name: 'Amersfoort', lat: 52.1561, lon: 5.3878 },
  { name: 'Haarlemmermeer', lat: 52.3030, lon: 4.6898 },
  { name: 'Zwolle', lat: 52.5168, lon: 6.0830 },
  { name: 'Zoetermeer', lat: 52.0575, lon: 4.4932 },
  { name: 'Leiden', lat: 52.1601, lon: 4.4970 },
  { name: 'Maastricht', lat: 50.8514, lon: 5.6909 },
  { name: 'Dordrecht', lat: 51.8133, lon: 4.6901 },
  { name: 'Ede', lat: 52.0408, lon: 5.6588 },
  { name: 'Alphen aan den Rijn', lat: 52.1286, lon: 4.6571 },
  { name: 'Westland', lat: 51.9988, lon: 4.2142 },
  { name: 'Alkmaar', lat: 52.6319, lon: 4.7482 },
  { name: 'Venlo', lat: 51.3704, lon: 6.1724 },
  { name: 'Leeuwarden', lat: 53.2012, lon: 5.7999 },
  { name: 'Hilversum', lat: 52.2234, lon: 5.1756 },
  { name: 'Amstelveen', lat: 52.3007, lon: 4.8632 },
  { name: 'Heerlen', lat: 50.8875, lon: 5.9806 },
  { name: 'Delft', lat: 52.0116, lon: 4.3571 },
  { name: 'Deventer', lat: 52.2551, lon: 6.1636 },
  { name: 'Purmerend', lat: 52.5050, lon: 4.9592 },
  { name: 'Roosendaal', lat: 51.5308, lon: 4.4653 },
  { name: 'Schiedam', lat: 51.9192, lon: 4.3989 },
  { name: 'Spijkenisse', lat: 51.8447, lon: 4.3297 },
  { name: 'Leiden', lat: 52.1601, lon: 4.4970 },
  { name: 'Helmond', lat: 51.4814, lon: 5.6559 },
  { name: 'Emmen', lat: 52.7792, lon: 6.9003 },
  { name: 'Assen', lat: 52.9968, lon: 6.5623 },
  { name: 'Den Bosch', lat: 51.6978, lon: 5.3036 },
  { name: "'s-Hertogenbosch", lat: 51.6978, lon: 5.3036 },
  { name: 'Hoogeveen', lat: 52.7227, lon: 6.4758 },
  { name: 'Oss', lat: 51.7650, lon: 5.5180 },
  { name: 'Vlaardingen', lat: 51.9123, lon: 4.3416 },
  { name: 'Zeist', lat: 52.0894, lon: 5.2317 },
  { name: 'Katwijk', lat: 52.2065, lon: 4.4232 },
  { name: 'Nieuwegein', lat: 52.0292, lon: 5.0808 },
]

// Fallback coördinaten (De Bilt - KNMI locatie, centrum NL)
export const FALLBACK_COORDINATES: CityCoordinates = {
  name: 'Nederland (gemiddeld)',
  lat: 52.1017,
  lon: 5.1781
}

/**
 * Zoek coördinaten voor een stad/plaats
 * Gebruikt fuzzy matching voor flexibiliteit
 */
export function getCityCoordinates(cityName: string): CityCoordinates {
  if (!cityName || cityName.trim() === '') {
    return FALLBACK_COORDINATES
  }

  const searchTerm = cityName.toLowerCase().trim()
  
  // Exacte match
  const exactMatch = DUTCH_CITIES.find(city => 
    city.name.toLowerCase() === searchTerm
  )
  if (exactMatch) return exactMatch

  // Partial match (stad naam zit in input)
  const partialMatch = DUTCH_CITIES.find(city =>
    searchTerm.includes(city.name.toLowerCase()) ||
    city.name.toLowerCase().includes(searchTerm)
  )
  if (partialMatch) return partialMatch

  // Geen match gevonden - gebruik fallback
  console.warn(`Stad "${cityName}" niet gevonden, gebruik fallback coördinaten`)
  return FALLBACK_COORDINATES
}