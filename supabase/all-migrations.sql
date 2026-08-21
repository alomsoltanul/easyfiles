-- ConvertTools SaaS — all migrations, in order.
-- Paste the whole file into the Supabase SQL Editor and press Run:
--   https://supabase.com/dashboard/project/swekpuhaowbmphxqzdfe/sql/new
--
-- Safe to re-run: every statement is create-if-not-exists or create-or-replace.
-- Generated from supabase/migrations/ — edit those, not this.


-- ============================================================
-- supabase/migrations/0001_init.sql
-- ============================================================

-- ConvertTools SaaS — core schema
-- Run order: 0001_init.sql -> 0002_rls.sql -> 0003_seed_plans.sql

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('month', 'year');
exception when duplicate_object then null; end $$;

-- Mirrors Stripe's subscription statuses so a webhook can write the value through.
do $$ begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.run_status as enum ('success', 'error');
exception when duplicate_object then null; end $$;

/* ------------------------------------------------------------------ */
/* updated_at helper                                                   */
/* ------------------------------------------------------------------ */

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

/* ------------------------------------------------------------------ */
/* profiles — one row per auth.users row                               */
/* ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        public.user_role not null default 'user',
  -- set by an admin; a banned user keeps their account but is refused at the gate
  banned_at   timestamptz,
  ban_reason  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx  on public.profiles (role) where role = 'admin';

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auth signups land in auth.users; mirror them into profiles automatically so
-- application code never has to create the row itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ */
/* plans — editable from the admin console                             */
/* ------------------------------------------------------------------ */

create table if not exists public.plans (
  id                    text primary key,          -- free | starter | pro | business
  name                  text not null,
  tagline               text,
  monthly_price_cents   integer not null default 0,
  yearly_price_cents    integer not null default 0,
  stripe_price_id_month text,
  stripe_price_id_year  text,
  -- { maxFileBytes, maxBatch, runsPerDay, videoPerDay, historyDays, seats, api }
  -- null inside a numeric field means unlimited
  limits                jsonb not null default '{}'::jsonb,
  features              jsonb not null default '[]'::jsonb,
  sort                  integer not null default 0,
  active                boolean not null default true,
  -- 'anon' and 'free' are real limit rows but only the paid ones are sold,
  -- so the pricing page renders where listed is true.
  listed                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------------ */
/* subscriptions — one active row per user                             */
/* ------------------------------------------------------------------ */

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                text not null references public.plans (id),
  interval               public.billing_interval not null default 'month',
  status                 public.subscription_status not null default 'active',
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- an admin can comp a plan without Stripe ever being involved
  comped                 boolean not null default false,
  comped_by              uuid references public.profiles (id),
  comped_note            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- A user has at most one live subscription; the webhook upserts against this.
create unique index if not exists subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');

create index if not exists subscriptions_user_idx     on public.subscriptions (user_id);
create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------------ */
/* tool_runs — the account benefit: saved history                      */
/* ------------------------------------------------------------------ */

create table if not exists public.tool_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  tool_slug    text not null,        -- matches Tool.href, e.g. '/pdf/merge'
  dept         text not null,        -- image | pdf | json | video
  label        text,                 -- denormalised Tool.label, for cheap listing
  file_count   integer not null default 1,
  input_bytes  bigint  not null default 0,
  output_bytes bigint  not null default 0,
  duration_ms  integer not null default 0,
  status       public.run_status not null default 'success',
  error_code   text,
  created_at   timestamptz not null default now()
);

create index if not exists tool_runs_user_time_idx on public.tool_runs (user_id, created_at desc);
create index if not exists tool_runs_slug_time_idx on public.tool_runs (tool_slug, created_at desc);
create index if not exists tool_runs_time_idx      on public.tool_runs (created_at desc);

/* ------------------------------------------------------------------ */
/* usage_daily — quota counters, cheap to read on every gate check     */
/* ------------------------------------------------------------------ */

create table if not exists public.usage_daily (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  day       date not null default (now() at time zone 'utc')::date,
  tool_slug text not null,
  runs      integer not null default 0,
  bytes     bigint  not null default 0,
  primary key (user_id, day, tool_slug)
);

create index if not exists usage_daily_day_idx on public.usage_daily (day desc);

-- Single round trip: append history and bump the counter together.
create or replace function public.record_tool_run(
  p_tool_slug    text,
  p_dept         text,
  p_label        text,
  p_file_count   integer,
  p_input_bytes  bigint,
  p_output_bytes bigint,
  p_duration_ms  integer,
  p_status       public.run_status,
  p_error_code   text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    return null;
  end if;

  insert into public.tool_runs (
    user_id, tool_slug, dept, label, file_count,
    input_bytes, output_bytes, duration_ms, status, error_code
  )
  values (
    v_user, p_tool_slug, p_dept, p_label, greatest(coalesce(p_file_count, 1), 1),
    greatest(coalesce(p_input_bytes, 0), 0), greatest(coalesce(p_output_bytes, 0), 0),
    greatest(coalesce(p_duration_ms, 0), 0), coalesce(p_status, 'success'), p_error_code
  )
  returning id into v_id;

  insert into public.usage_daily (user_id, day, tool_slug, runs, bytes)
  values (v_user, (now() at time zone 'utc')::date, p_tool_slug, 1, greatest(coalesce(p_input_bytes, 0), 0))
  on conflict (user_id, day, tool_slug) do update
    set runs  = public.usage_daily.runs + 1,
        bytes = public.usage_daily.bytes + excluded.bytes;

  return v_id;
end;
$$;

/* ------------------------------------------------------------------ */
/* stripe_events — webhook idempotency                                 */
/* ------------------------------------------------------------------ */

create table if not exists public.stripe_events (
  id           text primary key,     -- Stripe event id, evt_…
  type         text not null,
  processed_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* admin_audit — every admin mutation                                  */
/* ------------------------------------------------------------------ */

create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,         -- e.g. 'user.plan.change'
  target_type text,                  -- user | subscription | plan | tool
  target_id   text,
  meta        jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_time_idx  on public.admin_audit (created_at desc);
create index if not exists admin_audit_actor_idx on public.admin_audit (actor_id, created_at desc);

/* ------------------------------------------------------------------ */
/* feature_flags — per-tool overrides set from the admin console       */
/* ------------------------------------------------------------------ */

create table if not exists public.feature_flags (
  key        text primary key,       -- e.g. 'tool:/pdf/ocr'
  enabled    boolean not null default true,
  payload    jsonb not null default '{}'::jsonb,   -- { access: 'free' | 'pro' }
  updated_at timestamptz not null default now()
);

drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch before update on public.feature_flags
  for each row execute function public.touch_updated_at();

-- ============================================================
-- supabase/migrations/0002_rls.sql
-- ============================================================

-- ConvertTools SaaS — row level security
-- The service-role key bypasses every policy below; it is used only by
-- src/lib/supabase/admin.ts (Stripe webhook, admin mutations, cron).

/* ------------------------------------------------------------------ */
/* Admin predicate                                                     */
/* ------------------------------------------------------------------ */

-- security definer so it can read profiles without tripping the profiles
-- policies that call it — otherwise the check recurses.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and banned_at is null
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- A user may edit their own name and avatar. Privilege columns are off limits
-- unless the caller is an admin.
--
-- NOTE: this version is superseded by 0005_fix_profile_guard.sql. The service
-- role skips RLS policies but NOT triggers, so this body locked out the admin
-- console's own writes. Kept as-is so the migration history stays truthful.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.banned_at is distinct from old.banned_at
     or new.ban_reason is distinct from old.ban_reason
     or new.id is distinct from old.id then
    raise exception 'not allowed to change privileged profile columns';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

/* ------------------------------------------------------------------ */
/* plans — public read, admin write                                    */
/* ------------------------------------------------------------------ */

alter table public.plans enable row level security;

drop policy if exists plans_read_active on public.plans;
create policy plans_read_active on public.plans
  for select to anon, authenticated
  using (active or public.is_admin());

drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write on public.plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/* ------------------------------------------------------------------ */
/* subscriptions — read own, never write from the client               */
/* ------------------------------------------------------------------ */

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_self on public.subscriptions;
create policy subscriptions_select_self on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/* ------------------------------------------------------------------ */
/* tool_runs — insert own, read own                                    */
/* ------------------------------------------------------------------ */

alter table public.tool_runs enable row level security;

drop policy if exists tool_runs_select_self on public.tool_runs;
create policy tool_runs_select_self on public.tool_runs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists tool_runs_insert_self on public.tool_runs;
create policy tool_runs_insert_self on public.tool_runs
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists tool_runs_delete_self on public.tool_runs;
create policy tool_runs_delete_self on public.tool_runs
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

/* ------------------------------------------------------------------ */
/* usage_daily — insert and bump own counters                          */
/* ------------------------------------------------------------------ */

alter table public.usage_daily enable row level security;

drop policy if exists usage_daily_select_self on public.usage_daily;
create policy usage_daily_select_self on public.usage_daily
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists usage_daily_insert_self on public.usage_daily;
create policy usage_daily_insert_self on public.usage_daily
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists usage_daily_update_self on public.usage_daily;
create policy usage_daily_update_self on public.usage_daily
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* ------------------------------------------------------------------ */
/* stripe_events — service role only, no policies at all               */
/* ------------------------------------------------------------------ */

alter table public.stripe_events enable row level security;

/* ------------------------------------------------------------------ */
/* admin_audit — admins read, nobody writes from the client            */
/* ------------------------------------------------------------------ */

alter table public.admin_audit enable row level security;

drop policy if exists admin_audit_select_admin on public.admin_audit;
create policy admin_audit_select_admin on public.admin_audit
  for select to authenticated
  using (public.is_admin());

/* ------------------------------------------------------------------ */
/* feature_flags — public read (the tool registry needs it), admin write */
/* ------------------------------------------------------------------ */

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
  for select to anon, authenticated
  using (true);

drop policy if exists feature_flags_admin_write on public.feature_flags;
create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/* ------------------------------------------------------------------ */
/* Function grants                                                     */
/* ------------------------------------------------------------------ */

revoke all on function public.record_tool_run(
  text, text, text, integer, bigint, bigint, integer, public.run_status, text
) from public;

grant execute on function public.record_tool_run(
  text, text, text, integer, bigint, bigint, integer, public.run_status, text
) to authenticated;

-- ============================================================
-- supabase/migrations/0003_seed_plans.sql
-- ============================================================

-- ConvertTools SaaS — plan seed
-- Mirrors src/lib/plans.ts. That file is the compile-time source of truth;
-- these rows let the admin console edit prices and limits without a deploy.
--
-- limits keys:
--   maxFileBytes  bytes per file          (null = unlimited)
--   maxBatch      files per run           (null = unlimited)
--   runsPerDay    tool runs per day       (null = unlimited)
--   videoPerDay   video downloads per day (null = unlimited)
--   historyDays   saved history retention (null = forever, 0 = none)
--   seats         included seats
--   api           API access
--   proTools      unlocks the 12 access:'pro' tools

insert into public.plans
  (id, name, tagline, monthly_price_cents, yearly_price_cents, limits, features, sort, active, listed)
values
  (
    'anon', 'Anonymous', 'No account needed',
    0, 0,
    '{"maxFileBytes":26214400,"maxBatch":3,"runsPerDay":10,"videoPerDay":2,"historyDays":0,"seats":0,"api":false,"proTools":false}'::jsonb,
    '["44 free tools","No sign-up required","Files never leave your browser"]'::jsonb,
    0, true, false
  ),
  (
    'free', 'Free', 'Save your history',
    0, 0,
    '{"maxFileBytes":52428800,"maxBatch":5,"runsPerDay":30,"videoPerDay":5,"historyDays":30,"seats":1,"api":false,"proTools":false}'::jsonb,
    '["44 free tools","30 days of saved history","50 MB files","30 runs per day"]'::jsonb,
    1, true, false
  ),
  (
    'starter', 'Starter', 'For occasional heavy files',
    400, 3900,
    '{"maxFileBytes":104857600,"maxBatch":20,"runsPerDay":500,"videoPerDay":30,"historyDays":365,"seats":1,"api":false,"proTools":true}'::jsonb,
    '["All 56 tools","100 MB files","20 files per batch","500 runs per day","1 year of history","30 video downloads per day"]'::jsonb,
    2, true, true
  ),
  (
    'pro', 'Pro', 'For daily document work',
    900, 8900,
    '{"maxFileBytes":524288000,"maxBatch":100,"runsPerDay":null,"videoPerDay":100,"historyDays":null,"seats":1,"api":true,"proTools":true}'::jsonb,
    '["All 56 tools","500 MB files","100 files per batch","Unlimited runs","History kept forever","100 video downloads per day","API access"]'::jsonb,
    3, true, true
  ),
  (
    'business', 'Business', 'For teams',
    2900, 28900,
    '{"maxFileBytes":2147483648,"maxBatch":null,"runsPerDay":null,"videoPerDay":300,"historyDays":null,"seats":5,"api":true,"proTools":true}'::jsonb,
    '["All 56 tools","2 GB files","Unlimited batch size","Unlimited runs","History kept forever","300 video downloads per day","API access","5 seats"]'::jsonb,
    4, true, true
  )
on conflict (id) do update set
  name                = excluded.name,
  tagline             = excluded.tagline,
  monthly_price_cents = excluded.monthly_price_cents,
  yearly_price_cents  = excluded.yearly_price_cents,
  limits              = excluded.limits,
  features            = excluded.features,
  sort                = excluded.sort,
  active              = excluded.active,
  listed              = excluded.listed;

-- Stripe price IDs are filled in later, either from the admin console or with:
--   update public.plans set stripe_price_id_month = 'price_…',
--                           stripe_price_id_year  = 'price_…'
--    where id = 'starter';

-- ============================================================
-- supabase/migrations/0004_retention.sql
-- ============================================================

-- ConvertTools SaaS — history retention
--
-- Each plan declares how long history is kept in plans.limits->>'historyDays'.
-- A JSON null there means "keep forever", so those users are skipped entirely.
-- Called once a day by /api/cron/retention.

create or replace function public.prune_tool_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with user_plan as (
    select
      pr.id as user_id,
      coalesce(s.plan_id, 'free') as plan_id
    from public.profiles pr
    left join public.subscriptions s
      on s.user_id = pr.id
     and s.status in ('trialing', 'active', 'past_due')
  ),
  plan_days as (
    select id, (limits ->> 'historyDays')::int as days
    from public.plans
    where limits ->> 'historyDays' is not null
  )
  delete from public.tool_runs tr
  using user_plan up, plan_days pd
  where tr.user_id = up.user_id
    and pd.id = up.plan_id
    and tr.created_at < now() - make_interval(days => pd.days);

  get diagnostics v_deleted = row_count;

  -- Daily counters only ever feed the rolling quota window; three months is
  -- more than any limit needs and keeps the table small.
  delete from public.usage_daily
  where day < ((now() at time zone 'utc')::date - 90);

  return v_deleted;
end;
$$;

revoke all on function public.prune_tool_history() from public, anon, authenticated;
-- service_role only: the cron route calls this with the service key.
grant execute on function public.prune_tool_history() to service_role;

-- ============================================================
-- supabase/migrations/0005_fix_profile_guard.sql
-- ============================================================

-- ConvertTools SaaS — fix: the privilege guard also blocked the service role
--
-- guard_profile_privileges() in 0002_rls.sql only let the update through when
-- public.is_admin() was true. That predicate reads auth.uid(), which is null
-- for the service role — so every privileged write from the admin console
-- (setUserRoleAction, setUserBanAction) raised
-- "not allowed to change privileged profile columns".
--
-- Bypassing RLS is not the same as bypassing triggers: policies are skipped for
-- the service role, triggers still run.
--
-- The caller's role has to come from the JWT claim PostgREST puts in the
-- session, NOT from current_user. This function is SECURITY DEFINER, and inside
-- one of those current_user is the function's owner rather than whoever made
-- the request — it would have said 'postgres' for everybody and waved the whole
-- thing through.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text;
begin
  -- No JWT at all: a direct database connection — the SQL editor, a migration,
  -- psql. Anyone there already holds database credentials and could drop this
  -- trigger outright, so there is nothing to defend against.
  if v_claims is null or v_claims = '' then
    return new;
  end if;

  v_role := v_claims::json ->> 'role';

  -- service_role: the admin console's own writes and the Stripe webhook.
  if v_role = 'service_role' then
    return new;
  end if;

  -- A signed-in admin acting through the normal client.
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.banned_at is distinct from old.banned_at
     or new.ban_reason is distinct from old.ban_reason
     or new.id is distinct from old.id then
    raise exception 'not allowed to change privileged profile columns';
  end if;

  return new;
end;
$$;

-- Lets the app confirm which migrations a database has actually had applied,
-- instead of guessing from behaviour.
create or replace function public.schema_version()
returns text
language sql
stable
as $$ select '0005'::text $$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
