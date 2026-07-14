# Babykrant

Genereer een gepersonaliseerde babykrant op basis van een geboortedatum.
De krant combineert persoonlijke gegevens (naam, geboorteverhaal, foto's)
met historische data van die dag: nieuws, weer, tv-programmering,
kijkcijfers, muziek, films en meer — herschreven tot krantartikelen door
Claude (Haiku 4.5).

Live: [babykrant-claude.vercel.app](https://babykrant-claude.vercel.app)

## Wat het doet

1. **Wizard** (`/wizard`): ouders vullen basisgegevens, het geboorteverhaal
   en foto's in. Foto's gaan direct naar Vercel Blob; er wordt een
   concept-krant aangemaakt in Supabase (`generated_papers`).
2. **Dataverzameling**: per geboortedatum wordt data opgehaald uit ~10
   bronnen (Wikipedia, Wayback Machine/NOS/NU.nl, Open-Meteo, TMDB,
   Top 40, tv-gidsen, naambetekenis, Google News, nieuwsdossiers).
3. **Generatie** (`/generate-articles`): alle acht krantsecties worden in
   één gestructureerde Claude-call geschreven; per sectie regenereren kan.

## Architectuur

```
pg_cron (Supabase)
  → pg_net HTTP → Edge Functions (supabase/functions/)
    → scrapen tvgids.nl, kijkonderzoek.nl, flixpatrol.com,
      Google News RSS, top40.nl, VRT NWS + Al Jazeera
      → schrijven naar Supabase (daily_tv, daily_ratings, daily_streaming,
        daily_google_news, weekly_music, news_dossiers)

Next.js (Vercel)
  → API routes lezen eerst uit Supabase (cache)
    → miss: on-the-fly scrapen + resultaat terugschrijven (cache-on-read)
  → /api/generate-paper: één Claude-call met alle data → 8 artikelen
```

De dagelijkse pipeline bouwt vanaf nu een sluitende cache op: elke krant
voor een baby die vandaag of later geboren wordt, heeft straks complete
data zonder dat er live gescrapet hoeft te worden.

## Lokaal draaien

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser-tests (vitest)
npm run lint
npm run build
```

Zonder environment variables werkt de app in afgeslankte modus: geen
Supabase-cache, geen foto-upload, geen rate limiting. AI-generatie vereist
minimaal `ANTHROPIC_API_KEY`.

## Environment variables

| Variabele | Waarvoor |
|---|---|
| `ANTHROPIC_API_KEY` | Artikelgeneratie (Claude Haiku 4.5) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (client-side reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — alleen server-side, nooit `NEXT_PUBLIC_` |
| `BLOB_STORE_ID` (of `BLOB_READ_WRITE_TOKEN`) | Vercel Blob (foto-uploads); de OIDC-koppeling via het Storage-tabblad zet `BLOB_STORE_ID` automatisch |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis: rate limiting + wayback-cache (de Vercel-integratie zet deze automatisch; `UPSTASH_REDIS_REST_*` werkt ook) |
| `CRON_SECRET` | Verplicht voor `/api/cron/*` |
| `TMDB_API_KEY` | Films en series |
| `ENABLE_TEST_PAGE` | `true` = debug/testroutes open (alleen previews) |

## De dagelijkse pipeline

Setup en beheer staan in [`supabase/README.md`](supabase/README.md):

1. `supabase/migrations/0001_schema.sql` uitvoeren in de SQL editor
2. Edge Functions deployen (`npx supabase functions deploy ...`)
3. `supabase/migrations/0002_cron.sql` uitvoeren (placeholders invullen)

| Job | Bron | Schema (NL-tijd) | Tabel |
|---|---|---|---|
| scrape-tv | tvgids.nl | dagelijks 06:00 | `daily_tv` |
| scrape-google-news | Google News RSS | dagelijks 07:00 | `daily_google_news` |
| scrape-streaming | flixpatrol.com | dagelijks 08:00 | `daily_streaming` |
| scrape-ratings | kijkonderzoek.nl | dagelijks 10:00 | `daily_ratings` |
| scrape-music | top40.nl | maandag 12:00 | `weekly_music` |
| scrape-dossiers | VRT NWS, Al Jazeera | zondag 03:00 | `news_dossiers` |

Elke run werkt `scrape_sources` bij (`last_run_at`, `last_status`,
`last_error`), zodat een stille breuk direct zichtbaar is:

```sql
select name, last_run_at, last_status, last_error from scrape_sources;
```

## Tests

Parser-tests met vaste HTML-fixtures staan in `tests/`. Ze draaien in CI
(auto-merge workflow); als een bron zijn HTML-structuur wijzigt, faalt de
bijbehorende test en is meteen duidelijk welke parser brak.

## Mappen

```
app/               Next.js app router (wizard, generatie-UI, API routes)
components/        Wizard-stappen
lib/               Gedeelde modules (prompts, claude, supabase, cache, ...)
supabase/          Migraties + Edge Functions (dagelijkse pipeline)
scripts/           Losse tools (tv-bron scan, news discovery, export)
data/              Statische data (dossiers.json, scanrapporten)
tests/             Vitest parser-tests + HTML-fixtures
```

## Bewust nog niet gebouwd

Krant-layout/PDF-generatie, bestelflow en betaling (Mollie/iDEAL),
print-on-demand, AVG/juridisch en een scrape-health dashboard volgen later.
