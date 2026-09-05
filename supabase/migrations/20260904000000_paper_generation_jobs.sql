-- Durable, idempotent work queue for paper generation.
create table if not exists public.paper_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references public.generated_papers(id) on delete cascade,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_paper_generation_jobs_queue
  on public.paper_generation_jobs (available_at, created_at)
  where status = 'queued';

alter table public.paper_generation_jobs enable row level security;
-- No client policies: job information is exposed only after validating a paper session.

create or replace function public.enqueue_paper_generation(p_paper_id uuid, p_idempotency_key text)
returns setof public.paper_generation_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.paper_generation_jobs (paper_id, idempotency_key)
  values (p_paper_id, p_idempotency_key)
  on conflict (idempotency_key) do nothing;
  return query select * from public.paper_generation_jobs where idempotency_key = p_idempotency_key;
end; $$;

create or replace function public.claim_paper_generation_job()
returns setof public.paper_generation_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  -- A worker killed by the platform is reclaimed after its lease expires.
  select id into v_id from public.paper_generation_jobs
   where ((status = 'queued' and available_at <= now())
       or (status = 'running' and started_at < now() - interval '3 minutes'))
     and attempts < max_attempts
   order by available_at, created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.paper_generation_jobs
    set status = 'running', attempts = attempts + 1, started_at = now(),
        last_error = null, updated_at = now()
    where id = v_id returning *;
end; $$;

create or replace function public.complete_paper_generation_job(
  p_job_id uuid, p_articles jsonb, p_form_data jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_paper_id uuid;
begin
  select paper_id into v_paper_id from public.paper_generation_jobs
   where id = p_job_id and status = 'running' for update;
  if v_paper_id is null then raise exception 'job is not running'; end if;
  update public.generated_papers set generated_articles = p_articles,
    manual_edits = p_articles, form_data = p_form_data, status = 'generated'
    where id = v_paper_id;
  update public.paper_generation_jobs set status = 'completed', completed_at = now(),
    updated_at = now(), last_error = null where id = p_job_id;
end; $$;

create or replace function public.fail_paper_generation_job(p_job_id uuid, p_error text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.paper_generation_jobs set
    status = case when attempts >= max_attempts then 'failed' else 'queued' end,
    available_at = now() + make_interval(secs => least(300, 15 * power(2, greatest(attempts - 1, 0)))::int),
    last_error = left(p_error, 500), updated_at = now()
  where id = p_job_id and status = 'running';
end; $$;

create or replace function public.retry_paper_generation_job(p_paper_id uuid)
returns setof public.paper_generation_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query update public.paper_generation_jobs set status = 'queued', attempts = 0,
    available_at = now(), started_at = null, completed_at = null, last_error = null,
    updated_at = now() where paper_id = p_paper_id and status = 'failed' returning *;
end; $$;

revoke all on table public.paper_generation_jobs from anon, authenticated;
revoke all on function public.enqueue_paper_generation(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_paper_generation_job() from public, anon, authenticated;
revoke all on function public.complete_paper_generation_job(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fail_paper_generation_job(uuid, text) from public, anon, authenticated;
revoke all on function public.retry_paper_generation_job(uuid) from public, anon, authenticated;
grant all on table public.paper_generation_jobs to service_role;
grant execute on function public.enqueue_paper_generation(uuid, text) to service_role;
grant execute on function public.claim_paper_generation_job() to service_role;
grant execute on function public.complete_paper_generation_job(uuid, jsonb, jsonb) to service_role;
grant execute on function public.fail_paper_generation_job(uuid, text) to service_role;
grant execute on function public.retry_paper_generation_job(uuid) to service_role;
