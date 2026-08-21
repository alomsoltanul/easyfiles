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
