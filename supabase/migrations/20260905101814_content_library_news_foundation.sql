-- Additive news foundation. No production backfill, cron or paper-flow changes.
begin;

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  article_type text not null check (article_type in ('news', 'culture', 'name_meaning', 'name_namesakes', 'born_on_day')),
  editorial_status text not null default 'draft' check (editorial_status in ('draft', 'needs_review', 'approved', 'rejected', 'superseded')),
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, article_type)
);

create table public.news_articles (
  article_id uuid primary key,
  article_type text not null default 'news' check (article_type = 'news'),
  news_date date not null unique check (news_date between date '0001-01-01' and date '9999-12-31'),
  coverage_tier text not null check (coverage_tier in ('recent_week', 'recent_month', 'recent_year', 'historical_on_demand')),
  research_method text not null check (length(btrim(research_method)) between 1 and 100),
  foreign key (article_id, article_type) references public.articles(id, article_type)
);

create table public.content_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'news' check (job_type = 'news'),
  content_key date not null check (content_key between date '0001-01-01' and date '9999-12-31'),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_error text check (length(last_error) <= 1000),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_expires_at timestamptz,
  lock_token uuid,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A typed compound key avoids caller-controlled idempotency keys.
  unique (job_type, content_key),
  check (attempts <= max_attempts),
  check ((status = 'running' and locked_at is not null and lease_expires_at > locked_at and lock_token is not null)
    or (status <> 'running' and locked_at is null and lease_expires_at is null and lock_token is null)),
  check ((status in ('completed', 'failed')) = (finished_at is not null))
);
create index content_jobs_queued on public.content_jobs (available_at, created_at) where status = 'queued';
create index content_jobs_expired on public.content_jobs (lease_expires_at) where status = 'running';

create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id),
  version integer not null check (version > 0),
  body text not null check (length(btrim(body)) between 1 and 20000),
  facts_snapshot jsonb not null check (jsonb_typeof(facts_snapshot) = 'object'),
  sources_snapshot jsonb not null check (jsonb_typeof(sources_snapshot) = 'array' and jsonb_array_length(sources_snapshot) > 0),
  generation_metadata jsonb not null default '{}' check (jsonb_typeof(generation_metadata) = 'object'),
  change_summary text,
  created_by_type text not null check (created_by_type in ('ai', 'editor')),
  generation_job_id uuid unique references public.content_jobs(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  unique (article_id, version),
  unique (article_id, id),
  check (published_at is null or reviewed_at is not null)
);
-- The pointer must belong to this article, not merely to any existing revision.
alter table public.articles add constraint articles_current_revision_fk
  foreign key (id, current_revision_id) references public.article_revisions(article_id, id);

create table public.article_publications (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id),
  revision_id uuid not null,
  previous_revision_id uuid,
  actor_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (article_id, revision_id) references public.article_revisions(article_id, id),
  foreign key (article_id, previous_revision_id) references public.article_revisions(article_id, id)
);
create index article_publications_article on public.article_publications(article_id, created_at);

create function public.guard_article_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Revisions are retained'; end if;
  if (to_jsonb(new) - 'reviewed_at' - 'published_at') is distinct from
     (to_jsonb(old) - 'reviewed_at' - 'published_at') or old.published_at is not null then
    raise exception 'Revision content is immutable; create a new revision';
  end if;
  return new;
end;
$$;
create trigger article_revision_immutable before update or delete on public.article_revisions
  for each row execute function public.guard_article_revision();

create function public.guard_published_pointer() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.current_revision_id is not null and not exists (
    select 1 from public.article_revisions r where r.id = new.current_revision_id
      and r.article_id = new.id and r.published_at is not null
  ) then raise exception 'Current revision must be published and belong to this article'; end if;
  return new;
end;
$$;
create trigger articles_published_pointer before insert or update on public.articles
  for each row execute function public.guard_published_pointer();

create function public.enqueue_news_job(p_date date) returns public.content_jobs
language plpgsql security invoker set search_path = '' as $$
declare v_job public.content_jobs;
begin
  if p_date is null or p_date > (now() at time zone 'Europe/Amsterdam')::date then
    raise exception 'Invalid or future news date';
  end if;
  -- Concurrent inserts wait on the unique key. Never restart a completed job.
  insert into public.content_jobs(content_key) values (p_date)
    on conflict (job_type, content_key) do update set content_key = excluded.content_key
    returning * into v_job;
  return v_job;
end;
$$;

create function public.claim_news_job(p_lease_seconds integer default 300) returns setof public.content_jobs
language plpgsql security invoker set search_path = '' as $$
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 900 then raise exception 'Invalid lease'; end if;
  -- A worker that died on its last attempt must not remain running forever.
  update public.content_jobs set status = 'failed', finished_at = now(), updated_at = now(),
    locked_at = null, lease_expires_at = null, lock_token = null, last_error = 'lease_expired'
    where status = 'running' and lease_expires_at <= now() and attempts >= max_attempts;
  return query
  with candidate as (
    select id from public.content_jobs
    where attempts < max_attempts and ((status = 'queued' and available_at <= now())
      or (status = 'running' and lease_expires_at <= now()))
    order by available_at, created_at, id for update skip locked limit 1
  )
  update public.content_jobs j set status = 'running', attempts = j.attempts + 1,
    locked_at = now(), lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    lock_token = gen_random_uuid(), finished_at = null, updated_at = now()
    from candidate c where j.id = c.id returning j.*;
end;
$$;

create function public.fail_news_job(p_job_id uuid, p_lock_token uuid, p_error_code text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  -- Store a compact code, never full model responses or customer data.
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then raise exception 'Invalid error code'; end if;
  update public.content_jobs set
    status = case when attempts >= max_attempts then 'failed' else 'queued' end,
    finished_at = case when attempts >= max_attempts then now() else null end,
    available_at = now() + make_interval(secs => 30 * attempts * attempts),
    locked_at = null, lease_expires_at = null, lock_token = null,
    last_error = p_error_code, updated_at = now()
    where id = p_job_id and status = 'running' and lock_token = p_lock_token and lease_expires_at > now();
  return found;
end;
$$;

create function public.complete_news_job(
  p_job_id uuid, p_lock_token uuid, p_body text, p_facts jsonb, p_sources jsonb,
  p_metadata jsonb, p_coverage_tier text, p_research_method text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_job public.content_jobs; v_article_id uuid; v_revision_id uuid; v_source jsonb;
begin
  select * into v_job from public.content_jobs where id = p_job_id for update;
  if not found then raise exception 'Unknown job'; end if;
  -- Repeating a successful request is harmless even if its response was lost.
  if v_job.status = 'completed' then
    select id into v_revision_id from public.article_revisions where generation_job_id = p_job_id;
    return v_revision_id;
  end if;
  if v_job.status <> 'running' or v_job.lock_token is distinct from p_lock_token
    or v_job.lease_expires_at <= now() then raise exception 'Stale job claim'; end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) = 0 then
    raise exception 'Primary sources required';
  end if;
  for v_source in select value from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(v_source) <> 'object' or coalesce(v_source->>'url', '') !~ '^https?://[^/[:space:]]+'
      or length(btrim(coalesce(v_source->>'name', ''))) = 0 then raise exception 'Invalid primary source'; end if;
  end loop;
  select article_id into v_article_id from public.news_articles where news_date = v_job.content_key;
  if v_article_id is null then
    insert into public.articles(article_type) values ('news') returning id into v_article_id;
    insert into public.news_articles(article_id, news_date, coverage_tier, research_method)
      values (v_article_id, v_job.content_key, p_coverage_tier, p_research_method);
  end if;
  -- Serialize version allocation and editorial publication on the article row.
  perform 1 from public.articles where id = v_article_id for update;
  insert into public.article_revisions(article_id, version, body, facts_snapshot, sources_snapshot,
    generation_metadata, created_by_type, generation_job_id)
    select v_article_id, coalesce(max(version), 0) + 1, p_body, p_facts, p_sources, p_metadata, 'ai', p_job_id
      from public.article_revisions where article_id = v_article_id
    returning id into v_revision_id;
  update public.articles set editorial_status = 'needs_review', updated_at = now() where id = v_article_id;
  update public.content_jobs set status = 'completed', finished_at = now(), updated_at = now(),
    locked_at = null, lease_expires_at = null, lock_token = null, last_error = null where id = p_job_id;
  return v_revision_id;
end;
$$;

-- Internal primitive only: a future admin route must verify the actor server-side.
create function public.publish_article_revision(
  p_article_id uuid, p_revision_id uuid, p_expected_current_id uuid, p_actor_id uuid, p_reason text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_current uuid; v_revision public.article_revisions;
begin
  if p_actor_id is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Actor and publication reason required';
  end if;
  select current_revision_id into v_current from public.articles where id = p_article_id for update;
  if not found then raise exception 'Unknown article'; end if;
  if v_current is distinct from p_expected_current_id then raise exception 'Article changed; reload before publishing'; end if;
  select * into v_revision from public.article_revisions where id = p_revision_id and article_id = p_article_id;
  if not found then raise exception 'Revision does not belong to article'; end if;
  if v_current = p_revision_id then return p_revision_id; end if;
  if v_revision.published_at is null then
    update public.article_revisions set reviewed_at = now(), published_at = now() where id = p_revision_id;
  end if;
  update public.articles set current_revision_id = p_revision_id, editorial_status = 'approved', updated_at = now()
    where id = p_article_id;
  insert into public.article_publications(article_id, revision_id, previous_revision_id, actor_id, reason)
    values (p_article_id, p_revision_id, v_current, p_actor_id, p_reason);
  return p_revision_id;
end;
$$;

-- No public reads/writes or public RPC execution. Only trusted server credentials.
alter table public.articles enable row level security;
alter table public.news_articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.content_jobs enable row level security;
alter table public.article_publications enable row level security;
revoke all on public.articles, public.news_articles, public.article_revisions, public.content_jobs,
  public.article_publications from public, anon, authenticated;
grant select, insert, update on public.articles, public.news_articles, public.article_revisions, public.content_jobs to service_role;
grant select, insert on public.article_publications to service_role;
revoke all on function public.guard_article_revision(), public.guard_published_pointer(),
  public.enqueue_news_job(date), public.claim_news_job(integer), public.fail_news_job(uuid, uuid, text),
  public.complete_news_job(uuid, uuid, text, jsonb, jsonb, jsonb, text, text),
  public.publish_article_revision(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_news_job(date), public.claim_news_job(integer),
  public.fail_news_job(uuid, uuid, text), public.complete_news_job(uuid, uuid, text, jsonb, jsonb, jsonb, text, text),
  public.publish_article_revision(uuid, uuid, uuid, uuid, text) to service_role;

commit;
