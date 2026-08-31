# Supabase — database en dagelijkse pipeline

## Onderdelen

- `migrations/0001_schema.sql` — alle tabellen, indexes en RLS-policies
- `migrations/0002_cron.sql` — pg_cron jobs die de Edge Functions aanroepen
- `functions/` — de scrape-jobs (Supabase Edge Functions, Deno)

## Eenmalige setup

1. **Schema aanmaken**: open de Supabase SQL editor en voer
   `migrations/0001_schema.sql` uit.

2. **Edge Functions deployen** (met de Supabase CLI, `npx supabase`):

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase functions deploy scrape-tv scrape-ratings scrape-streaming \
     scrape-google-news scrape-music scrape-dossiers
   ```

   De functies gebruiken `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY`;
   die worden door Supabase automatisch in de runtime geïnjecteerd.

3. **Cron secrets in Vault zetten**: open de SQL editor en voer zelf uit
   (vul de echte waarden uitsluitend daar in, nooit in Git):

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<server-side secret key>', 'edge_function_secret_key');
   ```

   Gebruik de actuele server-side secret key uit Project Settings → API Keys.
   `vault.decrypted_secrets` mag niet aan `anon` of `authenticated` worden
   toegekend. Voer daarna `migrations/0002_cron.sql` uit in de SQL editor.

4. **Gastensessies en private foto-opslag**: review en voer
   `migrations/20260831181754_passwordless_guest_sessions.sql` uit. Deze maakt
   de private bucket, sessie-/herstellinktabellen en opruimjobs aan. De app
   verwijdert Storage-objecten via de Storage API voordat conceptrecords
   worden gewist; verwijder nooit rechtstreeks uit `storage.objects`.

## Handmatig een job draaien

Elke functie is los aan te roepen (bijv. om een gemiste dag in te halen):

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/scrape-tv?date=2026-07-13" \
  -H "Authorization: Bearer <service_role_key>"
```

De dagelijkse functies accepteren `?date=YYYY-MM-DD` (default: gisteren,
voor Google News: vandaag).

## Monitoring

```sql
-- Laatste status per bron
select name, last_run_at, last_status, last_error from scrape_sources;

-- Cron-geschiedenis
select * from cron.job_run_details order by start_time desc limit 20;
```

Een job schrijft `last_status = 'error'` met de foutmelding in `last_error`
zodra fetch, parse of database-write faalt — een lege sectie in de krant is
zo altijd herleidbaar tot de bron die stuk is.
