-- supabase/migrations/0001_schema.sql
-- Babykrant database schema
--
-- Uitvoeren in de Supabase SQL editor (of via supabase db push).
-- Volgorde: 0001_schema.sql → 0002_cron.sql
--
-- Ontwerp:
-- - De daily_*/weekly_* tabellen worden gevuld door de dagelijkse pipeline
--   (Edge Functions, getriggerd door pg_cron) én door cache-on-read vanuit
--   de bestaande API routes.
-- - Alle schrijfoperaties lopen server-side via de service role key.
-- - Row Level Security staat overal aan. De anon key mag alleen lezen op
--   publieke referentiedata (tv, kijkcijfers, streaming, nieuws, muziek).
--   Persoonsgegevens (generated_papers, paper_photos) zijn niet benaderbaar
--   met de anon key.

-- ============================================================================
-- Configuratie van scrape-bronnen
-- ============================================================================
create table if not exists scrape_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  source_type text not null, -- 'tv_guide', 'ratings', 'streaming', 'news_headlines', 'news_dossiers', 'music_chart', 'google_news'
  url_template text not null, -- URL met {date} placeholder
  selectors jsonb, -- CSS selectors, JSON paths, etc.
  schedule text not null, -- cron expression
  enabled boolean default true,
  last_run_at timestamptz,
  last_status text, -- 'success', 'error', 'partial'
  last_error text,
  created_at timestamptz default now()
);

-- ============================================================================
-- TV-programmering per dag (primetime)
-- ============================================================================
create table if not exists daily_tv (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  channel text not null, -- 'NPO1', 'RTL4', etc.
  time_slot text not null, -- '20:00', '20:30', etc.
  program_name text not null,
  genre text,
  description text,
  scraped_at timestamptz default now(),
  source text not null, -- 'tvgids.nl'
  unique(date, channel, time_slot)
);

create index if not exists idx_daily_tv_date on daily_tv(date);

-- ============================================================================
-- Kijkcijfers per dag
-- ============================================================================
create table if not exists daily_ratings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  rank integer not null,
  program_name text not null,
  channel text,
  viewers integer, -- aantal kijkers
  market_share numeric, -- marktaandeel %
  scraped_at timestamptz default now(),
  source text not null, -- 'kijkonderzoek.nl'
  unique(date, rank)
);

create index if not exists idx_daily_ratings_date on daily_ratings(date);

-- ============================================================================
-- Streaming top 10 per dag
-- ============================================================================
create table if not exists daily_streaming (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  rank integer not null,
  title text not null,
  platform text not null, -- 'Netflix', 'Disney+', 'Prime Video', etc.
  content_type text not null default 'onbekend', -- 'film', 'serie', 'onbekend'
  scraped_at timestamptz default now(),
  source text not null, -- 'flixpatrol.com'
  -- Films en series hebben elk een eigen top 10 per platform en delen dus
  -- rangnummers; content_type hoort daarom bij de sleutel.
  unique(date, rank, platform, content_type)
);

create index if not exists idx_daily_streaming_date on daily_streaming(date);

-- ============================================================================
-- Google News NL topics per dag
-- ============================================================================
create table if not exists daily_google_news (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  topic_category text not null, -- 'TOP', 'WORLD', 'NATION', 'BUSINESS', etc.
  title text not null,
  source_name text, -- 'NOS', 'NU.nl', 'RTL Nieuws', etc.
  published_at timestamptz,
  scraped_at timestamptz default now(),
  unique(date, topic_category, title)
);

create index if not exists idx_daily_google_news_date on daily_google_news(date);

-- ============================================================================
-- Nieuwsdossiers (wekelijks bijgewerkt vanuit VRT, Al Jazeera, etc.)
-- ============================================================================
create table if not exists news_dossiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null, -- 'vrt', 'aljazeera', 'reuters', 'france24', etc.
  source_url text,
  category text, -- 'conflict', 'politics', 'climate', 'health', etc.
  first_seen_at date not null,
  last_seen_at date not null, -- bijgewerkt bij elke scan
  active boolean default true,
  unique(name, source)
);

create index if not exists idx_news_dossiers_seen on news_dossiers(first_seen_at, last_seen_at);
create index if not exists idx_news_dossiers_active on news_dossiers(active);

-- ============================================================================
-- Muziek hitlijsten (wekelijks)
-- ============================================================================
create table if not exists weekly_music (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  rank integer not null,
  title text not null,
  artist text not null,
  scraped_at timestamptz default now(),
  source text not null, -- 'top40.nl'
  unique(week_start, rank)
);

create index if not exists idx_weekly_music_week on weekly_music(week_start);

-- ============================================================================
-- Dagkoppen NOS/NU.nl (via Wayback Machine, cache-on-read + pipeline)
-- Gebruikt door de nieuwssectie en de dossier-matching (fase 3).
-- headlines: jsonb array van { "title": string, "url"?: string }
-- ============================================================================
create table if not exists daily_headlines (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source text not null, -- 'www.nos.nl', 'www.nu.nl'
  headlines jsonb not null,
  snapshot_timestamp text, -- Wayback timestamp (YYYYMMDDhhmmss), indien via archive.org
  scraped_at timestamptz default now(),
  unique(date, source)
);

create index if not exists idx_daily_headlines_date on daily_headlines(date);

-- ============================================================================
-- Generieke cache voor bestaande API routes (cache-on-read, fase 2)
-- Voor bronnen zonder eigen tabel: weer, naambetekenis, beroemde
-- naamgenoten, TMDB, Wikipedia dag-/maandnieuws.
-- cache_key voorbeeld: 'weather:2024-05-01:amsterdam'
-- ============================================================================
create table if not exists api_cache (
  cache_key text primary key,
  endpoint text not null, -- 'weather', 'name_meaning', 'famous', 'tmdb', 'news_daily', 'news_monthly'
  date date, -- de opgevraagde datum, indien van toepassing
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_api_cache_endpoint_date on api_cache(endpoint, date);

-- ============================================================================
-- Gegenereerde babykranten
-- ============================================================================
create table if not exists generated_papers (
  id uuid primary key default gen_random_uuid(),
  baby_name text not null,
  birth_date date not null,
  birth_time text,
  birth_place text,
  form_data jsonb not null, -- alle wizard-input
  generated_articles jsonb, -- alle gegenereerde artikelen
  status text default 'draft', -- 'draft', 'generated', 'finalized'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- updated_at automatisch bijwerken
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_generated_papers_updated_at on generated_papers;
create trigger trg_generated_papers_updated_at
  before update on generated_papers
  for each row execute function set_updated_at();

drop trigger if exists trg_api_cache_updated_at on api_cache;
create trigger trg_api_cache_updated_at
  before update on api_cache
  for each row execute function set_updated_at();

-- ============================================================================
-- Foto's bij babykranten
-- ============================================================================
create table if not exists paper_photos (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid references generated_papers(id) on delete cascade,
  file_path text not null, -- Vercel Blob URL
  position integer, -- volgorde
  uploaded_at timestamptz default now()
);

create index if not exists idx_paper_photos_paper on paper_photos(paper_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table scrape_sources enable row level security;
alter table daily_tv enable row level security;
alter table daily_ratings enable row level security;
alter table daily_streaming enable row level security;
alter table daily_google_news enable row level security;
alter table news_dossiers enable row level security;
alter table weekly_music enable row level security;
alter table daily_headlines enable row level security;
alter table api_cache enable row level security;
alter table generated_papers enable row level security;
alter table paper_photos enable row level security;

-- Publieke referentiedata: leesbaar met de anon key.
-- Schrijven kan alleen met de service role key (die omzeilt RLS).
create policy "anon read daily_tv" on daily_tv for select to anon using (true);
create policy "anon read daily_ratings" on daily_ratings for select to anon using (true);
create policy "anon read daily_streaming" on daily_streaming for select to anon using (true);
create policy "anon read daily_google_news" on daily_google_news for select to anon using (true);
create policy "anon read news_dossiers" on news_dossiers for select to anon using (true);
create policy "anon read weekly_music" on weekly_music for select to anon using (true);
create policy "anon read daily_headlines" on daily_headlines for select to anon using (true);

-- scrape_sources, api_cache, generated_papers en paper_photos hebben géén
-- anon-policies: alleen server-side toegang via de service role key.
