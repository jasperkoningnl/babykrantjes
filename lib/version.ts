// lib/version.ts
// Centraal versiebestand - update dit bij elke release
// Dit is de single source of truth voor de applicatie versie

export const APP_VERSION = 'v3.4.0'
export const APP_VERSION_FULL = 'v3.4.0 - Dossiercontext in nieuwssectie'
export const RELEASE_DATE = '2026-07-14'
export const RELEASE_NOTES = {
  major: 'Nieuwssectie herkent langlopende dossiers en geeft context',
  features: [
    'Referentielijst van 18 langlopende nieuwsdossiers (data/dossiers.json)',
    'Deterministische dossiermatcher met periode-filter (lib/dossierMatcher.ts)',
    'Nieuwsprompt krijgt dossierachtergrond bij koppen van de geboortedag',
    'Geverifieerde bronnenlijst topic-indexpagina\'s (scripts/verificatie-resultaten.md)'
  ]
}
