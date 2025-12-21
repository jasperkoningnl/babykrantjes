// lib/version.ts
// Centraal versiebestand - update dit bij elke release
// Dit is de single source of truth voor de applicatie versie

export const APP_VERSION = 'v3.3.0'
export const APP_VERSION_FULL = 'v3.3.0 - Consistent Versiebeheer'
export const RELEASE_DATE = '2025-12-21'
export const RELEASE_NOTES = {
  major: 'Consistent versiebeheer over alle paginas',
  features: [
    'Gecentraliseerd versiebeheer in één bestand',
    'Verwijderd verwarrende versie meldingen van test-results pagina',
    'Synchronisatie tussen package.json en app versie',
    'Automatisch versie-bump script voor consistente updates'
  ]
}
