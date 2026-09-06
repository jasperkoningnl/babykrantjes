-- Private editorial references. Example text is imported separately, never into the public repository.
create table public.news_style_examples (
  id text primary key,
  title text not null,
  news_date date not null,
  body text not null check (char_length(body) between 1 and 10000),
  style_note text not null default '',
  sort_order integer not null,
  created_at timestamptz not null default now()
);
alter table public.news_style_examples enable row level security;
revoke all on public.news_style_examples from public, anon, authenticated;
grant select, insert, update, delete on public.news_style_examples to service_role;
