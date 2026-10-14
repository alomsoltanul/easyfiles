-- ConvertTools SaaS — user profile link pages (Linktree-style profiles)
-- Root /[username] routing, customizable links, themes, socials, and metrics.

/* ------------------------------------------------------------------ */
/* 1. Reserved Usernames                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.reserved_usernames (
  username    text primary key,
  reason      text not null default 'system_route',
  created_at  timestamptz not null default now()
);

-- Seed with existing routes, tools, auth, proxy decoys, and critical system paths
insert into public.reserved_usernames (username, reason) values
  ('admin', 'admin_route'),
  ('administrator', 'system_decoy'),
  ('admin-console', 'admin_route'),
  ('account', 'site_route'),
  ('api', 'system_route'),
  ('auth', 'site_route'),
  ('app', 'system_route'),
  ('assets', 'static_route'),
  ('billing', 'site_route'),
  ('blog', 'system_route'),
  ('cancel', 'site_route'),
  ('cdn', 'system_route'),
  ('checkout', 'site_route'),
  ('contact', 'system_route'),
  ('cpanel', 'system_decoy'),
  ('dashboard', 'site_route'),
  ('docs', 'system_route'),
  ('download', 'system_route'),
  ('faq', 'system_route'),
  ('favicon.ico', 'static_file'),
  ('features', 'site_route'),
  ('help', 'system_route'),
  ('history', 'site_route'),
  ('home', 'site_route'),
  ('image', 'tool_dept'),
  ('json', 'tool_dept'),
  ('legal', 'system_route'),
  ('login', 'system_decoy'),
  ('log-in', 'system_decoy'),
  ('not-found', 'system_route'),
  ('pdf', 'tool_dept'),
  ('phpmyadmin', 'system_decoy'),
  ('pricing', 'site_route'),
  ('privacy', 'site_route'),
  ('profile', 'system_route'),
  ('r', 'redirect_handler'),
  ('robots.txt', 'static_file'),
  ('settings', 'site_route'),
  ('signin', 'system_decoy'),
  ('sign-in', 'system_decoy'),
  ('sign-in-failed', 'site_route'),
  ('signup', 'site_route'),
  ('sign-up', 'site_route'),
  ('sitemap.xml', 'static_file'),
  ('static', 'system_route'),
  ('status', 'system_route'),
  ('stripe', 'system_route'),
  ('success', 'site_route'),
  ('support', 'system_route'),
  ('terms', 'site_route'),
  ('tool', 'tool_dept'),
  ('tools', 'tool_dept'),
  ('u', 'system_prefix'),
  ('user', 'system_route'),
  ('users', 'system_route'),
  ('video', 'tool_dept'),
  ('video-tools', 'tool_dept'),
  ('webhook', 'system_route'),
  ('webhooks', 'system_route'),
  ('wp-admin', 'system_decoy'),
  ('wp-login.php', 'system_decoy')
on conflict (username) do nothing;

/* ------------------------------------------------------------------ */
/* 2. User Link Profiles                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.user_link_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users (id) on delete cascade,
  username            text not null unique,
  display_name        text not null,
  bio                 text not null default '',
  avatar_url          text,
  theme_config        jsonb not null default '{
    "theme": "default",
    "background_type": "color",
    "background_value": "#0f172a",
    "card_style": "rounded",
    "card_color": "#1e293b",
    "text_color": "#ffffff",
    "accent_color": "#38bdf8",
    "font": "sans"
  }'::jsonb,
  social_links        jsonb not null default '{}'::jsonb,
  featured_tool_slug  text,
  is_published        boolean not null default true,
  view_count          bigint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint username_format_check check (
    username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
  ),
  constraint bio_length_check check (
    char_length(bio) <= 300
  ),
  constraint display_name_length_check check (
    char_length(display_name) >= 1 and char_length(display_name) <= 60
  )
);

create or replace trigger tr_touch_user_link_profiles
  before update on public.user_link_profiles
  for each row execute function public.touch_updated_at();

-- Trigger preventing reserved username claims
create or replace function public.guard_reserved_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Force lowercase username
  new.username := lower(new.username);

  if exists (
    select 1 from public.reserved_usernames
    where username = new.username
  ) then
    raise exception 'The username "%" is reserved and cannot be claimed.', new.username
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace trigger tr_guard_reserved_username
  before insert or update of username on public.user_link_profiles
  for each row execute function public.guard_reserved_username();

/* ------------------------------------------------------------------ */
/* 3. Profile Links Items                                             */
/* ------------------------------------------------------------------ */

create table if not exists public.profile_links (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.user_link_profiles (id) on delete cascade,
  title       text not null,
  url         text not null,
  icon        text,
  is_active   boolean not null default true,
  position    integer not null default 0,
  click_count bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint link_title_check check (
    char_length(title) >= 1 and char_length(title) <= 100
  ),
  constraint link_url_check check (
    char_length(url) >= 1 and char_length(url) <= 2000
  )
);

create or replace trigger tr_touch_profile_links
  before update on public.profile_links
  for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------------ */
/* 4. High-Performance Indexes                                        */
/* ------------------------------------------------------------------ */

create unique index if not exists idx_user_link_profiles_username_lower
  on public.user_link_profiles (lower(username));

create index if not exists idx_user_link_profiles_user_id
  on public.user_link_profiles (user_id);

create index if not exists idx_profile_links_profile_position
  on public.profile_links (profile_id, position)
  where is_active = true;

/* ------------------------------------------------------------------ */
/* 5. Row Level Security (RLS)                                         */
/* ------------------------------------------------------------------ */

alter table public.reserved_usernames enable row level security;
alter table public.user_link_profiles enable row level security;
alter table public.profile_links enable row level security;

-- Reserved usernames: public read-only (so frontend can check availability client-side)
drop policy if exists reserved_usernames_select_all on public.reserved_usernames;
create policy reserved_usernames_select_all on public.reserved_usernames
  for select to public
  using (true);

-- User link profiles:
-- 1. Public can read published profiles
drop policy if exists user_link_profiles_select_public on public.user_link_profiles;
create policy user_link_profiles_select_public on public.user_link_profiles
  for select to public
  using (is_published = true or (auth.uid() is not null and user_id = auth.uid()));

-- 2. Authenticated user can manage their own profile
drop policy if exists user_link_profiles_insert_owner on public.user_link_profiles;
create policy user_link_profiles_insert_owner on public.user_link_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_link_profiles_update_owner on public.user_link_profiles;
create policy user_link_profiles_update_owner on public.user_link_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_link_profiles_delete_owner on public.user_link_profiles;
create policy user_link_profiles_delete_owner on public.user_link_profiles
  for delete to authenticated
  using (user_id = auth.uid());

-- Profile links:
-- 1. Public can read active links of published profiles
drop policy if exists profile_links_select_public on public.profile_links;
create policy profile_links_select_public on public.profile_links
  for select to public
  using (
    exists (
      select 1 from public.user_link_profiles p
      where p.id = profile_links.profile_id
        and (p.is_published = true or (auth.uid() is not null and p.user_id = auth.uid()))
    )
  );

-- 2. Owner can manage links
drop policy if exists profile_links_insert_owner on public.profile_links;
create policy profile_links_insert_owner on public.profile_links
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_link_profiles p
      where p.id = profile_links.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists profile_links_update_owner on public.profile_links;
create policy profile_links_update_owner on public.profile_links
  for update to authenticated
  using (
    exists (
      select 1 from public.user_link_profiles p
      where p.id = profile_links.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_link_profiles p
      where p.id = profile_links.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists profile_links_delete_owner on public.profile_links;
create policy profile_links_delete_owner on public.profile_links
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_link_profiles p
      where p.id = profile_links.profile_id
        and p.user_id = auth.uid()
    )
  );

/* ------------------------------------------------------------------ */
/* 6. High-Throughput Atomic Metrics (RPC)                             */
/* ------------------------------------------------------------------ */

create or replace function public.increment_profile_views(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_link_profiles
  set view_count = view_count + 1
  where lower(username) = lower(p_username)
    and is_published = true;
end;
$$;

create or replace function public.increment_link_clicks(p_link_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  update public.profile_links
  set click_count = click_count + 1
  where id = p_link_id
  returning url into v_url;

  return v_url;
end;
$$;

revoke all on function public.increment_profile_views(text) from public;
grant execute on function public.increment_profile_views(text) to authenticated, anon;

revoke all on function public.increment_link_clicks(uuid) from public;
grant execute on function public.increment_link_clicks(uuid) to authenticated, anon;

/* ------------------------------------------------------------------ */
/* 7. Supabase Storage for Profile Assets                             */
/* ------------------------------------------------------------------ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-assets',
  'profile-assets',
  true,
  2097152, -- 2MB max
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Storage RLS:
-- 1. Anyone can view public profile assets
drop policy if exists "Public access to profile assets" on storage.objects;
create policy "Public access to profile assets" on storage.objects
  for select to public
  using (bucket_id = 'profile-assets');

-- 2. Authenticated users can upload to their own user_id directory
drop policy if exists "Authenticated users upload profile assets" on storage.objects;
create policy "Authenticated users upload profile assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Authenticated users can update/delete their own assets
drop policy if exists "Authenticated users update profile assets" on storage.objects;
create policy "Authenticated users update profile assets" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users delete profile assets" on storage.objects;
create policy "Authenticated users delete profile assets" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
