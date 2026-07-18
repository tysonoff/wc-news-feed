-- WCNewsFeed — initial schema for a fresh Supabase project.
--
-- This reconstructs the proven SaskNewsFeed schema (profiles, articles,
-- votes + cast_vote, comments, comment_reports, saved_articles) from the
-- application code, since no migration file existed in the original repo,
-- PLUS the new multi-region pieces (regions table, articles.region).
--
-- Run this once, in full, against a brand new Supabase project's SQL
-- editor. It is not idempotent-safe to re-run partially — it's meant to
-- bootstrap an empty database.
--
-- Reminder from the handoff doc: RLS policies and GRANTs are two separate
-- layers. Every table below gets both — a missing GRANT will silently
-- block a "correct" RLS policy, and vice versa.

-- ============================================================
-- 1. regions — the new multi-province piece
-- ============================================================

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,             -- 'saskatchewan', 'alberta', 'manitoba', 'british-columbia', 'national'
  display_name text not null,            -- 'Alberta'
  domain text unique not null,           -- 'ab.wcnewsfeed.com' — what domain-detection matches on
  brand_primary_color text not null,     -- e.g. '#0b3d91'
  brand_accent_color text not null,      -- e.g. '#f2b705'
  created_at timestamptz not null default now()
);

alter table public.regions enable row level security;

create policy "regions are publicly readable"
  on public.regions for select
  to anon, authenticated
  using (true);

grant select on public.regions to anon, authenticated;
-- No insert/update/delete grants for anon/authenticated — regions are
-- managed by hand (or a future admin tool) via the service role only.

-- Placeholder domains below use subdomains of wcnewsfeed.com so the app
-- works end-to-end before any province-specific domain is purchased.
-- Swap the `domain` value per row later if a dedicated domain (e.g.
-- albertanewsfeed.com) is bought for a region — nothing else needs to
-- change, since domain-detection reads this table's data, not a
-- hardcoded list.
insert into public.regions (slug, display_name, domain, brand_primary_color, brand_accent_color) values
  ('alberta',           'Alberta',           'ab.wcnewsfeed.com', '#0b3d91', '#f2b705'),
  ('saskatchewan',      'Saskatchewan',      'sk.wcnewsfeed.com', '#1b5e3f', '#d4a72c'),
  ('manitoba',          'Manitoba',          'mb.wcnewsfeed.com', '#a6192e', '#4a4a4a'),
  ('british-columbia',  'British Columbia',  'bc.wcnewsfeed.com', '#003087', '#fcb514'),
  ('national',          'National',          'wcnewsfeed.com',    '#1a1a2e', '#d52b1e');

-- ============================================================
-- 2. profiles
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Usernames need to be publicly readable (comments join profiles to show
-- who posted), but never writable by a client directly — profile creation
-- goes exclusively through the /api/set-username route using the service
-- role key, which bypasses RLS entirely. No insert/update/delete policy
-- is defined here on purpose.
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

grant select on public.profiles to anon, authenticated;
-- Deliberately no insert/update/delete grant to anon/authenticated.

-- ============================================================
-- 3. articles
-- ============================================================

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text unique not null,
  source_name text not null,
  region text not null references public.regions (slug),
  published_at timestamptz not null,
  image_url text,
  guid text,
  vote_count int not null default 0,
  created_at timestamptz not null default now()
);

create index articles_published_at_idx on public.articles (published_at desc);
create index articles_region_idx on public.articles (region);
create index articles_region_published_at_idx on public.articles (region, published_at desc);

alter table public.articles enable row level security;

create policy "articles are publicly readable"
  on public.articles for select
  to anon, authenticated
  using (true);

grant select on public.articles to anon, authenticated;
-- Writes (insert/update/delete) only ever happen from the scraper's cron
-- route using the service role key. No client-facing write policy/grant.

-- ============================================================
-- 4. votes + cast_vote()
-- ============================================================

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote_type smallint not null check (vote_type in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index votes_article_id_idx on public.votes (article_id);

alter table public.votes enable row level security;

-- Clients may read only their own vote (used to show which arrow is lit
-- up), never anyone else's.
create policy "users can read their own votes"
  on public.votes for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.votes to authenticated;
-- No insert/update/delete grant here — all vote mutation goes through
-- cast_vote() below, which runs SECURITY DEFINER and bypasses RLS. This
-- is what makes "vote counting is never trusted from the client" actually
-- true: there is no direct path for a client to touch this table's rows.

create or replace function public.cast_vote(p_article_id uuid, p_value smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous smallint;
  v_delta int;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to vote';
  end if;

  if p_value not in (-1, 0, 1) then
    raise exception 'invalid vote value: %', p_value;
  end if;

  -- Advisory lock scoped to this article for the rest of the transaction
  -- so two simultaneous votes on the same article can't read-modify-write
  -- past each other and silently drop one vote's effect on vote_count.
  perform pg_advisory_xact_lock(hashtext(p_article_id::text));

  select vote_type into v_previous
  from votes
  where article_id = p_article_id and user_id = auth.uid();

  v_previous := coalesce(v_previous, 0);

  if p_value = 0 then
    delete from votes where article_id = p_article_id and user_id = auth.uid();
  elsif v_previous = 0 then
    insert into votes (article_id, user_id, vote_type)
    values (p_article_id, auth.uid(), p_value);
  else
    update votes
    set vote_type = p_value, updated_at = now()
    where article_id = p_article_id and user_id = auth.uid();
  end if;

  v_delta := p_value - v_previous;

  if v_delta <> 0 then
    update articles set vote_count = vote_count + v_delta where id = p_article_id;
  end if;
end;
$$;

grant execute on function public.cast_vote(uuid, smallint) to authenticated;

-- ============================================================
-- 5. comments + comment_reports
-- ============================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_article_id_idx on public.comments (article_id);
create index comments_user_id_idx on public.comments (user_id);

alter table public.comments enable row level security;

create policy "comments are publicly readable"
  on public.comments for select
  to anon, authenticated
  using (true);

create policy "signed-in users can post comments as themselves"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_user_id)
);

alter table public.comment_reports enable row level security;

-- Reports are write-only from the client's perspective — nobody's report
-- list is readable by anon/authenticated; only the service role (for
-- future moderation tooling) can read this table.
create policy "signed-in users can report comments"
  on public.comment_reports for insert
  to authenticated
  with check (auth.uid() = reporter_user_id);

grant insert on public.comment_reports to authenticated;

-- ============================================================
-- 6. saved_articles
-- ============================================================

create table public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid references public.articles (id) on delete set null,
  title text not null,
  url text not null,
  image_url text,
  source_name text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

create index saved_articles_user_id_idx on public.saved_articles (user_id);

alter table public.saved_articles enable row level security;

create policy "users can read their own saved articles"
  on public.saved_articles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can save articles for themselves"
  on public.saved_articles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can unsave their own saved articles"
  on public.saved_articles for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.saved_articles to authenticated;
