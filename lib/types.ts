// Types voor de babykrant applicatie

export interface BasisGegevens {
  volledigeNaam: string;
  geboorteDatum: string; // YYYY-MM-DD
  geboorteTijd: string; // HH:MM
  geboorteLocatie: 'thuis' | 'ziekenhuis' | 'anders';
  geboorteLocatieNaam?: string; // Naam van ziekenhuis of andere locatie
  gewicht: number; // in grammen
  lengte: number; // in cm
  woonplaats?: string; // optioneel, als afwijkend
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

// Voor later: berekende gegevens
export interface BerekendGegevens {
  sterrenbeeld: string;
  chineesJaar: string;
  geboortebloem: string;
  geboortesteen: string;
  kleur: string;
}