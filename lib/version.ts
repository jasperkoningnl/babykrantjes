// lib/version.ts
// Centraal versiebestand - update dit bij elke release
// Dit is de single source of truth voor de applicatie versie

export const APP_VERSION = 'v3.3.1'
export const APP_VERSION_FULL = 'v3.3.1 - Claude Auto-Merge Workflow'
export const RELEASE_DATE = '2025-12-21'
export const RELEASE_NOTES = {
  major: 'Claude auto-merge workflow voor gestroomlijnde releases',
  features: [
    'Automatische merge van Claude branches na PR approval',
    'Wayback scraper betrouwbaarheidsverbeteringen (v1.6.0)',
    'Gecentraliseerd versiebeheer',
    'Automatisch versie-bump script'
  ]
}
