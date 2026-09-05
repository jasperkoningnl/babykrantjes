-- supabase/migrations/0002_cron.sql
-- Dagelijkse pipeline: pg_cron + pg_net triggeren de Edge Functions.
--
-- VOORAF HANDMATIG IN VAULT OPSLAAN (nooit in dit bestand plakken):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<dedicated scrape secret>', 'scrape_function_secret');
--
-- LET OP: pg_cron draait in UTC. Nederland is UTC+1 (winter) / UTC+2 (zomer).
-- De schema's hieronder zijn in UTC gezet zodat ze rond de bedoelde
-- Nederlandse tijden vallen.
--
-- Uitvoeren in de Supabase SQL editor, ná 0001_schema.sql en nadat de
-- Edge Functions gedeployed zijn:
--   supabase functions deploy scrape-tv scrape-ratings scrape-streaming \
--     scrape-google-news scrape-music scrape-dossiers

-- Extensions (op Supabase beschikbaar, ook op free tier)
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

-- Stop zonder de bestaande jobs te wijzigen als de vereiste Vault-records
-- ontbreken. De waarden zelf komen nooit in deze migratie of cron.job terecht.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    raise exception 'Vault secret project_url ontbreekt';
  end if;
  if not exists (select 1 from vault.secrets where name = 'scrape_function_secret') then
    raise exception 'Vault secret scrape_function_secret ontbreekt';
  end if;
end
$$;

-- ============================================================================
-- Seed scrape_sources (administratie; de Edge Functions werken
-- last_run_at/last_status/last_error bij op naam)
-- ============================================================================
insert into scrape_sources (name, source_type, url_template, schedule) values
  ('tvgids-nl',        'tv_guide',      'https://www.tvgids.nl/gids/{date}/{zender-slug}',            '0 5 * * *'),
  ('kijkonderzoek-nl', 'ratings',       'https://kijkonderzoek.nl/component/kijkcijfers/file,d1-{daysAgo}-0-p', '0 9 * * *'),
  ('flixpatrol',       'streaming',     'https://flixpatrol.com/top10/streaming/netherlands/{date}/', '0 7 * * *'),
  ('google-news-nl',   'google_news',   'https://news.google.com/rss?hl=nl&gl=NL&ceid=NL:nl',         '0 6 * * *'),
  ('top40-nl',         'music_chart',   'https://www.top40.nl/top40',                                 '0 11 * * 1'),
  ('news-dossiers',    'news_dossiers', 'https://www.vrt.be/vrtnws/nl/dossiers/',                     '0 2 * * 0')
on conflict (name) do update set
  source_type = excluded.source_type,
  url_template = excluded.url_template,
  schedule = excluded.schedule;

-- ============================================================================
-- Cron jobs
-- ============================================================================

-- cron.schedule is niet op alle pg_cron-versies een upsert. Verwijder alleen
-- de zes jobs van deze migratie, zodat opnieuw uitvoeren hetzelfde resultaat
-- oplevert en andere cronjobs ongemoeid blijven.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'scrape-tv-daily',
  'scrape-ratings-daily',
  'scrape-streaming-daily',
  'scrape-google-news-daily',
  'scrape-music-weekly',
  'scrape-dossiers-weekly'
);

-- Job 1: TV-programmering — 06:00 NL ≈ 05:00 UTC (dagelijks)
select cron.schedule('scrape-tv-daily', '0 5 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-tv',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- Job 2: Kijkcijfers — 10:00 NL ≈ 09:00 UTC (dagelijks)
select cron.schedule('scrape-ratings-daily', '0 9 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-ratings',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- Job 3: Streaming top 10 — 08:00 NL ≈ 07:00 UTC (dagelijks)
select cron.schedule('scrape-streaming-daily', '0 7 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-streaming',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- Job 4: Google News NL — 07:00 NL ≈ 06:00 UTC (dagelijks)
select cron.schedule('scrape-google-news-daily', '0 6 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-google-news',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- Job 5: Top 40 — maandag 12:00 NL ≈ 11:00 UTC (wekelijks)
select cron.schedule('scrape-music-weekly', '0 11 * * 1', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-music',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- Job 6: Nieuwsdossiers — zondag 03:00 NL ≈ 02:00 UTC (wekelijks)
select cron.schedule('scrape-dossiers-weekly', '0 2 * * 0', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scrape-dossiers',
    headers := jsonb_build_object('x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_function_secret'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$);

-- ============================================================================
-- Handige queries voor beheer:
--   select * from cron.job;                                  -- alle jobs
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('scrape-tv-daily');               -- job verwijderen
--   select name, last_run_at, last_status, last_error from scrape_sources;
-- ============================================================================
