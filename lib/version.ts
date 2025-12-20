// lib/version.ts
// Centraal versiebestand - update dit bij elke release

export const APP_VERSION = 'v2.0.0'
export const APP_VERSION_FULL = 'v2.0.0 - Claude Haiku'
export const RELEASE_DATE = '2025-12-20'
export const RELEASE_NOTES = {
  major: 'Claude Haiku 3.5 integratie voor artikel generatie',
  features: [
    'Migratie van Gemini naar Claude Haiku voor betere Nederlandse teksten',
    'Verhoogde token limiet (1000 tokens) voor uitgebreidere artikelen',
    'Verbeterde error handling en logging',
    'Rate limiting actief (50 requests/dag, $1.00 budget)'
  ]
}
