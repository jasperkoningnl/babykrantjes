// lib/types.ts
// @version 2.0.0
// Types voor de babykrant applicatie - UPDATED voor AI implementatie
// 
// BREAKING CHANGES v2.0.0:
// - BasisGegevens: naamVader/naamMoeder -> ouder1Naam/ouder2Naam/alleenstaand
// - ExtraVragen: Volledig herzien voor gestructureerde AI input
// 
// Let op: NameMeaningData, FamousNamesakesData en FamousPerson types
// worden nu geëxporteerd vanuit hun eigen API bestanden:
// - nameMeaningAPI.ts
// - famousNamesakesAPI.ts

export interface BroertjeZusje {
  naam: string
  leeftijd?: number  // optioneel - in jaren
}

export interface BasisGegevens {
  volledigeNaam: string
  geboorteDatum: string // YYYY-MM-DD
  geboorteTijd: string // HH:MM
  geboorteplaats: string // Stad/plaats - verplicht voor weerbericht
  geboorteLocatie: 'thuis' | 'ziekenhuis' | 'anders'
  geboorteLocatieNaam?: string // Naam van ziekenhuis of andere locatie
  gewicht: number // in grammen
  lengte: number // in cm
  
  // UPDATED v2.0.0: Inclusieve ouder-velden
  ouder1Naam: string        // Bijv. moeder, maar kan ook anders
  ouder2Naam?: string       // Optioneel - bijv. vader/partner
  alleenstaand: boolean     // Geeft aan of er maar 1 ouder is
}

export interface ExtraVragen {
  // ========================================================================
  // TIER 2: Heel belangrijk voor hoofdartikel
  // RELEASE: bevallingVerloop wordt VERPLICHT (nu optioneel voor testing)
  // ========================================================================
  
  bevallingVerloop?: 'snel' | 'langdurig' | 'spannend' | 'gepland' | 'anders' | 'niet-delen'
  bevallingAndersOmschrijving?: string  // Alleen ingevuld als bevallingVerloop === 'anders'
  
  naamReden?: string  // Waarom deze naam? Max 100 karakters, optioneel
  
  heeftBroertjesZusjes: boolean  // Toggle: heeft dit kindje broertjes/zusjes?
  broertjesZusjes: BroertjeZusje[]  // Alleen ingevuld als heeftBroertjesZusjes === true
  
  // ========================================================================
  // TIER 3: Leuk maar optioneel - voor extra kleur in het artikel
  // ========================================================================
  
  bijzonderheden?: string  // Bijzonderheden bij geboorte (vrij tekstveld)
}

export interface GeuploadeFotos {
  foto1?: File | null
  foto2?: File | null
  foto3?: File | null
  foto4?: File | null
}

export interface BabykrantData {
  basisGegevens: BasisGegevens
  extraVragen: ExtraVragen
  fotos: GeuploadeFotos
}

// Berekende gegevens
export interface BerekendGegevens {
  sterrenbeeld: string
  chineesJaar: string
  geboortebloem: string
  geboortesteen: string
  kleur: string
}