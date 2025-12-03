// Types voor de babykrant applicatie

export interface BasisGegevens {
  volledigeNaam: string;
  geboorteDatum: string; // YYYY-MM-DD
  geboorteTijd: string; // HH:MM
  geboorteplaats: string; // Stad/plaats - verplicht voor weerbericht
  geboorteLocatie: 'thuis' | 'ziekenhuis' | 'anders';
  geboorteLocatieNaam?: string; // Naam van ziekenhuis of andere locatie
  gewicht: number; // in grammen
  lengte: number; // in cm
  naamVader: string;
  naamMoeder: string;
}

export interface ExtraVragen {
  waarWarenOuders: string;
  hoeGingBevalling: string;
  wieWarenBij: string;
  waarWarenGrootouders: string;
  eersteKraamvisite: string;
  zwangerschapVerloop: string;
  andereDetails: string;
}

export interface GeuploadeFotos {
  foto1?: File | null;
  foto2?: File | null;
  foto3?: File | null;
  foto4?: File | null;
}

export interface BabykrantData {
  basisGegevens: BasisGegevens;
  extraVragen: ExtraVragen;
  fotos: GeuploadeFotos;
}

// Berekende gegevens
export interface BerekendGegevens {
  sterrenbeeld: string;
  chineesJaar: string;
  geboortebloem: string;
  geboortesteen: string;
  kleur: string;
}

// Naam betekenis en bekende naamdragers
export interface FamousPerson {
  name: string;
  description: string;
  wikipediaUrl?: string;
  source: 'nl' | 'en';
}

export interface NameData {
  firstName: string;
  meaning: string | null;
  origin: string | null;
  famousPersons: FamousPerson[];
  sources: {
    nl: string | null;
    en: string | null;
  };
}