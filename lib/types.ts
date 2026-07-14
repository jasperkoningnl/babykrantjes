// lib/types.ts
// @version 3.0.0
// Types voor de babykrant applicatie - AI implementatie compleet
// 
// BREAKING CHANGES v3.0.0:
// - BasisGegevens: geboorteLocatie/geboorteLocatieNaam verplaatst naar ExtraVragen
// - ExtraVragen: Volledige uitbreiding met 10 vragen voor rijk hoofdartikel
//
// BREAKING CHANGES v2.0.0:
// - BasisGegevens: naamVader/naamMoeder -> ouder1Naam/ouder2Naam/alleenstaand
// - ExtraVragen: Volledig herzien voor gestructureerde AI input

export interface BroertjeZusje {
  naam: string
  leeftijd?: number  // optioneel - in jaren
}

export interface BasisGegevens {
  volledigeNaam: string
  geboorteDatum: string // YYYY-MM-DD
  geboorteTijd: string // HH:MM
  geboorteplaats: string // Stad/plaats - verplicht voor weerbericht
  // REMOVED v3.0.0: geboorteLocatie en geboorteLocatieNaam -> verplaatst naar ExtraVragen
  gewicht: number // in grammen
  lengte: number // in cm
  
  // UPDATED v2.0.0: Inclusieve ouder-velden
  ouder1Naam: string        // Bijv. moeder, maar kan ook anders
  ouder2Naam?: string       // Optioneel - bijv. vader/partner
  alleenstaand: boolean     // Geeft aan of er maar 1 ouder is
}

export interface ExtraVragen {
  // ========================================================================
  // SECTIE 1: DE BEVALLING
  // Voor het hoofdverhaal - het moment zelf
  // ========================================================================
  
  // Waar geboren (MOVED van BasisGegevens v3.0.0)
  geboorteLocatie: 'thuis' | 'ziekenhuis' | 'geboortecentrum' | 'anders'
  geboorteLocatieNaam?: string  // Alleen ingevuld als ziekenhuis of anders
  
  // Hoe was bevalling
  // RELEASE: wordt VERPLICHT (nu optioneel voor testing)
  bevallingVerloop?: 'snel' | 'langdurig' | 'spannend' | 'gepland' | 'anders' | 'niet-delen'
  bevallingAndersOmschrijving?: string  // Alleen ingevuld als bevallingVerloop === 'anders'
  
  // Wie waren erbij (TIER 3 - optioneel)
  wieWarenErbij?: string[]  // ["Partner", "Opa/oma", "Doula", "Vriendin", "Niemand anders"]
  
  // ========================================================================
  // SECTIE 2: DE ZWANGERSCHAP
  // Context vooraf - geeft kleur aan het verhaal
  // ========================================================================
  
  zwangerschapVerloop?: string  // Vrij tekstveld, max 200 karakters
  
  // ========================================================================
  // SECTIE 3: DE NAAM
  // Belangrijk verhaal element
  // ========================================================================
  
  voornaamReden?: string  // Waarom deze voornaam? Max 300 karakters
  achternaamReden?: string  // Waarom deze achternaam? Max 300 karakters, optioneel
  
  // ========================================================================
  // SECTIE 4: FAMILIE & EERSTE DAGEN
  // Emotionele momenten
  // ========================================================================
  
  heeftBroertjesZusjes: boolean  // Toggle: heeft dit kindje broertjes/zusjes?
  broertjesZusjes: BroertjeZusje[]  // Alleen ingevuld als heeftBroertjesZusjes === true
  reactieBroertjesZusjes?: string  // Hoe reageerden ze? Max 150 karakters, alleen als heeftBroertjesZusjes
  
  eersteKraamvisite?: string  // Wie kwam als eerste op kraamvisite? Max 100 karakters
  
  // ========================================================================
  // SECTIE 5: BIJZONDERHEDEN
  // Unieke details
  // ========================================================================
  
  bijzonderheden?: string  // Bijzonderheden of leuke details? Max 300 karakters
}

// UPDATED v4.0.0: Foto's worden direct bij selectie naar Vercel Blob
// geüpload. De wizard-state bevat alleen nog URLs (die overleven
// JSON.stringify naar localStorage, in tegenstelling tot File-objecten).
export interface UploadedPhoto {
  url: string            // Vercel Blob URL
  photoId?: string | null // paper_photos.id in Supabase, indien gekoppeld
  fileName?: string      // oorspronkelijke bestandsnaam (voor weergave)
}

export interface GeuploadeFotos {
  foto1?: UploadedPhoto | null
  foto2?: UploadedPhoto | null
  foto3?: UploadedPhoto | null
  foto4?: UploadedPhoto | null
}

export interface BabykrantData {
  basisGegevens: BasisGegevens
  extraVragen: ExtraVragen
  fotos: GeuploadeFotos
  /** generated_papers.id in Supabase; gezet zodra de wizard een concept-krant heeft aangemaakt */
  paperId?: string | null
}

// Berekende gegevens
export interface BerekendGegevens {
  sterrenbeeld: string
  chineesJaar: string
  geboortebloem: string
  geboortesteen: string
  kleur: string
}