begin;
alter table public.articles add column editorial_version integer not null default 0 check (editorial_version >= 0);
create table public.article_drafts (
  article_id uuid primary key references public.articles(id),
  body text not null check (length(btrim(body)) between 1 and 20000),
  facts jsonb not null check (jsonb_typeof(facts) = 'object'),
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) between 1 and 20),
  base_revision_id uuid,
  edit_version integer not null default 1 check (edit_version > 0),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (article_id, base_revision_id) references public.article_revisions(article_id, id)
);
alter table public.article_drafts enable row level security;
revoke all on public.article_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.article_drafts to service_role;

create function public.save_news_draft(p_date date, p_body text, p_facts jsonb, p_sources jsonb,
  p_expected_version integer, p_actor_id uuid) returns public.article_drafts
language plpgsql security invoker set search_path = '' as $$
declare v_article uuid; v_current uuid; v_version integer; v_draft public.article_drafts; v_source jsonb;
begin
  if p_actor_id is null or p_date is null or p_date > (now() at time zone 'Europe/Amsterdam')::date
    or p_expected_version is null or p_expected_version < 0 then raise exception 'Invalid draft input'; end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) not between 1 and 20 then
    raise exception 'Sources required'; end if;
  for v_source in select value from jsonb_array_elements(p_sources) loop
    if coalesce(v_source->>'url', '') !~ '^https?://[^/[:space:]]+' or length(btrim(coalesce(v_source->>'name', ''))) = 0 then
      raise exception 'Invalid source'; end if;
  end loop;
  -- Serialize first-time creation and saves for this date.
  perform pg_advisory_xact_lock(109, (p_date - date '2000-01-01'));
  select article_id into v_article from public.news_articles where news_date = p_date;
  if v_article is null then
    insert into public.articles(article_type) values ('news') returning id into v_article;
    insert into public.news_articles(article_id, news_date, coverage_tier, research_method)
      values(v_article, p_date, 'historical_on_demand', 'editorial_sources');
  end if;
  select current_revision_id, editorial_version into v_current, v_version from public.articles where id = v_article for update;
  select * into v_draft from public.article_drafts where article_id = v_article;
  if v_version <> p_expected_version then raise exception 'Draft changed; reload'; end if;
  insert into public.article_drafts(article_id, body, facts, sources, base_revision_id, updated_by, edit_version)
    values(v_article, p_body, p_facts, p_sources, v_current, p_actor_id, v_version + 1)
    on conflict (article_id) do update set body = excluded.body, facts = excluded.facts, sources = excluded.sources,
      edit_version = excluded.edit_version, updated_by = excluded.updated_by, updated_at = now()
    returning * into v_draft;
  update public.articles set editorial_status = 'needs_review', editorial_version = v_version + 1, updated_at = now() where id = v_article;
  return v_draft;
end;
$$;

create function public.publish_news_draft(p_article_id uuid, p_expected_version integer,
  p_expected_current_id uuid, p_actor_id uuid, p_reason text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_draft public.article_drafts; v_current uuid; v_revision uuid;
begin
  select current_revision_id into v_current from public.articles where id = p_article_id for update;
  if not found or v_current is distinct from p_expected_current_id then raise exception 'Article changed; reload'; end if;
  select * into v_draft from public.article_drafts where article_id = p_article_id;
  if not found or v_draft.edit_version is distinct from p_expected_version then raise exception 'Draft changed; reload'; end if;
  if v_draft.base_revision_id is distinct from v_current then raise exception 'Publication changed; reconcile draft first'; end if;
  insert into public.article_revisions(article_id, version, body, facts_snapshot, sources_snapshot, created_by_type, change_summary)
    select p_article_id, coalesce(max(version),0)+1, v_draft.body, v_draft.facts, v_draft.sources, 'editor', p_reason
      from public.article_revisions where article_id = p_article_id returning id into v_revision;
  perform public.publish_article_revision(p_article_id, v_revision, p_expected_current_id, p_actor_id, p_reason);
  delete from public.article_drafts where article_id = p_article_id;
  update public.articles set editorial_version = editorial_version + 1 where id = p_article_id;
  return v_revision;
end;
$$;

-- One pilot only. Reserve a conservative euro per attempt, including failures.
-- No public RPC to reset the counter or increase the cap.
create table public.news_pilot_budget (
  id boolean primary key default true check (id),
  reserved_cents integer not null default 0 check (reserved_cents between 0 and 500)
);
insert into public.news_pilot_budget(id) values (true);
alter table public.news_pilot_budget enable row level security;
revoke all on public.news_pilot_budget from public, anon, authenticated;
grant select, update on public.news_pilot_budget to service_role;
create function public.reserve_news_pilot_attempt() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.news_pilot_budget set reserved_cents = reserved_cents + 100 where id and reserved_cents <= 400;
  return found;
end;
$$;
revoke all on function public.save_news_draft(date,text,jsonb,jsonb,integer,uuid),
  public.publish_news_draft(uuid,integer,uuid,uuid,text), public.reserve_news_pilot_attempt() from public, anon, authenticated;
grant execute on function public.save_news_draft(date,text,jsonb,jsonb,integer,uuid),
  public.publish_news_draft(uuid,integer,uuid,uuid,text), public.reserve_news_pilot_attempt() to service_role;
commit;
