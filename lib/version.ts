// lib/version.ts
// Centraal versiebestand - update dit bij elke release
// Dit is de single source of truth voor de applicatie versie

export const APP_VERSION = 'v4.0.0'
export const APP_VERSION_FULL = 'v4.0.0 - Herbouw: Supabase pipeline, Blob-foto\'s, één AI-call'
export const RELEASE_DATE = '2026-07-14'
export const RELEASE_NOTES = {
  major: 'Grote herbouw: dagelijkse datapipeline in Supabase, persistentie en beveiliging',
  features: [
    'Supabase gekoppeld: schema, cache-on-read laag en krant-persistentie (generated_papers)',
    'Dagelijkse scrape-pipeline: 6 Edge Functions + pg_cron (tv, kijkcijfers, streaming, Google News, Top 40, dossiers)',
    'Nieuwsartikel in twee blokken met dossier-matching op de geboortedag',
    'Foto-upload naar Vercel Blob — foto\'s overleven refresh en localStorage',
    'Model-upgrade naar Haiku 4.5 en alle 8 secties in één gestructureerde call',
    'Server-side rate limiting op IP, TLS-hack verwijderd, debugroutes achter env-flag',
    'Parser-tests met HTML-fixtures in CI'
  ]
}
