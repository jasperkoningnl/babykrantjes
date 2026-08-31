-- Passwordless guest sessions, private photo storage and retention.
-- This migration intentionally contains no real project URLs or secrets.

create extension if not exists pgcrypto;

alter table public.generated_papers
  alter column baby_name drop not null,
  alter column birth_date drop not null,
  alter column form_data set default '{}'::jsonb,
  add column if not exists contact_email text,
  add column if not exists manual_edits jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists revoked_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now();

alter table public.paper_photos
  alter column paper_id set not null,
  add column if not exists mime_type text not null default 'image/webp',
  add column if not exists byte_size integer,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

comment on column public.paper_photos.file_path is
  'Server-generated object path in the private paper-photos bucket; never a public URL.';

create table if not exists public.paper_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.generated_papers(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_paper_guest_sessions_paper
  on public.paper_guest_sessions (paper_id);
create index if not exists idx_paper_guest_sessions_active
  on public.paper_guest_sessions (token_hash, expires_at)
  where revoked_at is null;

create table if not exists public.paper_recovery_links (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.generated_papers(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_paper_recovery_links_active
  on public.paper_recovery_links (token_hash, expires_at)
  where used_at is null and revoked_at is null;

alter table public.paper_guest_sessions enable row level security;
alter table public.paper_recovery_links enable row level security;
-- No anon/authenticated policies: all access is via server-only service credentials.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'paper-photos',
  'paper-photos',
  false,
  10485760,
  array['image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only the service role uses Storage through the application server. No public policies.

create or replace function public.consume_paper_recovery_link(p_token_hash text)
returns table (paper_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.paper_recovery_links
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and revoked_at is null
     and expires_at > now()
  returning paper_recovery_links.paper_id;
end;
$$;

revoke all on function public.consume_paper_recovery_link(text) from public, anon, authenticated;
grant execute on function public.consume_paper_recovery_link(text) to service_role;

-- The application cron calls this only after removing private Storage objects via
-- the Storage API. It returns candidates; it does not manipulate storage.objects.
create or replace function public.abandoned_paper_ids(p_before timestamptz)
returns table (paper_id uuid)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select id
    from public.generated_papers
   where status = 'draft'
     and last_activity_at < p_before
     and (revoked_at is not null or expires_at < now() or last_activity_at < now() - interval '30 days');
$$;

revoke all on function public.abandoned_paper_ids(timestamptz) from public, anon, authenticated;
grant execute on function public.abandoned_paper_ids(timestamptz) to service_role;

-- Defense in depth: expire sessions and recovery links daily inside Postgres.
select cron.schedule(
  'expire-paper-guest-access',
  '17 2 * * *',
  $$
    update public.paper_guest_sessions
       set revoked_at = coalesce(revoked_at, now())
     where revoked_at is null and expires_at < now();
    update public.paper_recovery_links
       set revoked_at = coalesce(revoked_at, now())
     where revoked_at is null and (used_at is not null or expires_at < now());
  $$
);
