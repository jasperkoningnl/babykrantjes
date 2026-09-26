-- Redactie via Claude-taken: nieuws per dag en cultuur per week.
-- De redactie-connector (app/api/redactie) leest en publiceert direct; er is geen
-- beheeromgeving meer. Additief: bestaande tabellen en revisies blijven staan.
begin;

create table public.culture_articles (
  article_id uuid primary key,
  article_type text not null default 'culture' check (article_type = 'culture'),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  foreign key (article_id, article_type) references public.articles(id, article_type)
);
alter table public.culture_articles enable row level security;
revoke all on public.culture_articles from public, anon, authenticated;
grant select, insert on public.culture_articles to service_role;

-- De connector publiceert zonder persoonlijke gebruikers-id; de reden beschrijft de publicatie.
alter table public.article_publications alter column actor_id drop not null;

create function public.publish_library_article(p_type text, p_key date, p_body text, p_sources jsonb, p_note text default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_article uuid; v_current uuid; v_revision uuid; v_version integer; v_source jsonb;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_type is null or p_type not in ('news', 'culture') then raise exception 'Unknown article type'; end if;
  if p_key is null or p_key > (now() at time zone 'Europe/Amsterdam')::date then raise exception 'Invalid or future date'; end if;
  if p_type = 'culture' and extract(isodow from p_key) <> 1 then raise exception 'Culture weeks start on Monday'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 20000 then raise exception 'Invalid body'; end if;
  if length(v_note) > 1000 then raise exception 'Note too long'; end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) not between 1 and 30 then
    raise exception 'Sources required'; end if;
  for v_source in select value from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(v_source) <> 'object' or coalesce(v_source->>'url', '') !~ '^https?://[^/[:space:]]+'
      or length(btrim(coalesce(v_source->>'name', ''))) = 0 then raise exception 'Invalid source'; end if;
  end loop;

  -- Serialize first-time creation per type and key; same lock space as save_news_draft for news.
  perform pg_advisory_xact_lock(case p_type when 'news' then 109 else 110 end, (p_key - date '2000-01-01'));
  if p_type = 'news' then
    select n.article_id into v_article from public.news_articles n where n.news_date = p_key;
  else
    select c.article_id into v_article from public.culture_articles c where c.week_start = p_key;
  end if;
  if v_article is null then
    insert into public.articles(article_type) values (p_type) returning id into v_article;
    if p_type = 'news' then
      insert into public.news_articles(article_id, news_date, coverage_tier, research_method)
        values (v_article, p_key, 'recent_year', 'claude_redactie');
    else
      insert into public.culture_articles(article_id, week_start) values (v_article, p_key);
    end if;
  end if;

  select a.current_revision_id into v_current from public.articles a where a.id = v_article for update;
  select coalesce(max(r.version), 0) + 1 into v_version from public.article_revisions r where r.article_id = v_article;
  insert into public.article_revisions(article_id, version, body, facts_snapshot, sources_snapshot,
      generation_metadata, change_summary, created_by_type, reviewed_at, published_at)
    values (v_article, v_version, btrim(p_body), '{}', p_sources,
      jsonb_build_object('channel', 'redactie-connector'), v_note, 'ai', now(), now())
    returning id into v_revision;
  update public.articles set current_revision_id = v_revision, editorial_status = 'approved',
    editorial_version = editorial_version + 1, updated_at = now() where id = v_article;
  insert into public.article_publications(article_id, revision_id, previous_revision_id, actor_id, reason)
    values (v_article, v_revision, v_current, null, coalesce(v_note, 'Gepubliceerd via redactie-connector'));
  return jsonb_build_object('article_id', v_article, 'revision_id', v_revision, 'version', v_version);
end;
$$;

-- Eén artikel met de gepubliceerde versie en een eventueel oud, ongepubliceerd concept.
create function public.library_article(p_type text, p_key date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_article uuid; v_result jsonb;
begin
  if p_type = 'news' then
    select n.article_id into v_article from public.news_articles n where n.news_date = p_key;
  elsif p_type = 'culture' then
    select c.article_id into v_article from public.culture_articles c where c.week_start = p_key;
  else
    raise exception 'Unknown article type';
  end if;
  if v_article is null then return null; end if;
  select jsonb_build_object(
    'article_id', a.id,
    'published', case when r.id is null then null else jsonb_build_object('revision_id', r.id, 'version', r.version,
      'body', r.body, 'sources', r.sources_snapshot, 'published_at', r.published_at, 'note', r.change_summary) end,
    'draft', case when d.article_id is null then null else jsonb_build_object('body', d.body, 'sources', d.sources,
      'updated_at', d.updated_at) end)
    into v_result
    from public.articles a
    -- A rejected article counts as absent until it is published again.
    left join public.article_revisions r on r.id = a.current_revision_id and r.published_at is not null
      and a.editorial_status <> 'rejected'
    left join public.article_drafts d on d.article_id = a.id and a.editorial_status <> 'rejected'
    where a.id = v_article;
  return v_result;
end;
$$;

-- Bestaande artikelen in een periode; ontbrekende datums bepaalt de aanroeper.
create function public.library_overview(p_type text, p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', k.content_key, 'version', r.version,
      'published_at', r.published_at, 'has_draft', d.article_id is not null) order by k.content_key), '[]'::jsonb)
    from (
      select n.article_id, n.news_date as content_key from public.news_articles n
        where p_type = 'news' and n.news_date between p_from and p_to
      union all
      select c.article_id, c.week_start from public.culture_articles c
        where p_type = 'culture' and c.week_start between p_from and p_to
    ) k
    join public.articles a on a.id = k.article_id and a.editorial_status <> 'rejected'
    left join public.article_revisions r on r.id = a.current_revision_id and r.published_at is not null
    left join public.article_drafts d on d.article_id = k.article_id;
$$;

revoke all on function public.publish_library_article(text, date, text, jsonb, text),
  public.library_article(text, date), public.library_overview(text, date, date) from public, anon, authenticated;
grant execute on function public.publish_library_article(text, date, text, jsonb, text),
  public.library_article(text, date), public.library_overview(text, date, date) to service_role;

commit;
