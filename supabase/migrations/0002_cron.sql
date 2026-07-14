-- supabase/migrations/0002_cron.sql
-- Dagelijkse pipeline: pg_cron + pg_net triggeren de Edge Functions.
--
-- VOORAF INVULLEN (zoek-en-vervang in dit bestand):
--   {project-ref}       → het Supabase project-ref (uit de project-URL)
--   {service_role_key}  → de service role key (Dashboard → Settings → API)
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

-- Job 1: TV-programmering — 06:00 NL ≈ 05:00 UTC (dagelijks)
select cron.schedule('scrape-tv-daily', '0 5 * * *', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-tv',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);

-- Job 2: Kijkcijfers — 10:00 NL ≈ 09:00 UTC (dagelijks)
select cron.schedule('scrape-ratings-daily', '0 9 * * *', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-ratings',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);

-- Job 3: Streaming top 10 — 08:00 NL ≈ 07:00 UTC (dagelijks)
select cron.schedule('scrape-streaming-daily', '0 7 * * *', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-streaming',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);

-- Job 4: Google News NL — 07:00 NL ≈ 06:00 UTC (dagelijks)
select cron.schedule('scrape-google-news-daily', '0 6 * * *', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-google-news',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);

-- Job 5: Top 40 — maandag 12:00 NL ≈ 11:00 UTC (wekelijks)
select cron.schedule('scrape-music-weekly', '0 11 * * 1', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-music',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);

-- Job 6: Nieuwsdossiers — zondag 03:00 NL ≈ 02:00 UTC (wekelijks)
select cron.schedule('scrape-dossiers-weekly', '0 2 * * 0', $$
  select net.http_post(
    url := 'https://{project-ref}.supabase.co/functions/v1/scrape-dossiers',
    headers := '{"Authorization": "Bearer {service_role_key}", "Content-Type": "application/json"}'::jsonb,
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
