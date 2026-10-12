-- ConvertTools — admin console identities
--
-- The console no longer rides on customer auth. Admins are their own set of
-- rows here, authenticated by NextAuth (credentials + Google) and never present
-- in auth.users at all. A customer account can therefore never become an admin
-- by flipping a column, and an admin never carries a plan, a subscription or
-- usage history.
--
-- Both tables are service-role only: RLS is enabled and no policy is created,
-- so anon and authenticated see nothing even with a valid customer JWT.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.admin_role as enum ('owner', 'admin', 'viewer');
exception when duplicate_object then null; end $$;

/* ------------------------------------------------------------------ */
/* admin_users — one row per person who can open the console           */
/* ------------------------------------------------------------------ */

create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  -- stored lowercase; the check keeps the unique index below honest
  email         text not null check (email = lower(email)),
  name          text,
  image_url     text,
  -- null when the account signs in with Google only
  password_hash text,
  -- Google's stable subject claim, bound on first successful Google sign-in
  google_sub    text,
  role          public.admin_role not null default 'admin',
  -- set instead of deleting: the audit log keeps pointing at a real row
  disabled_at   timestamptz,
  last_login_at timestamptz,
  created_by    uuid references public.admin_users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists admin_users_email_key
  on public.admin_users (email);

create unique index if not exists admin_users_google_sub_key
  on public.admin_users (google_sub)
  where google_sub is not null;

drop trigger if exists admin_users_touch on public.admin_users;
create trigger admin_users_touch before update on public.admin_users
  for each row execute function public.touch_updated_at();

alter table public.admin_users enable row level security;
-- deliberately no policies: only the service-role key reads or writes this

/* ------------------------------------------------------------------ */
/* admin_login_attempts — throttling and forensics for the login form  */
/* ------------------------------------------------------------------ */

create table if not exists public.admin_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  -- recorded even when no admin_users row matches, so probing shows up
  email      text not null,
  ip         text,
  ok         boolean not null default false,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_email_idx
  on public.admin_login_attempts (email, created_at desc);

create index if not exists admin_login_attempts_ip_idx
  on public.admin_login_attempts (ip, created_at desc);

alter table public.admin_login_attempts enable row level security;
-- deliberately no policies, as above

/* ------------------------------------------------------------------ */
/* admin_audit — actor is now an admin_users row                       */
/* ------------------------------------------------------------------ */

-- The old constraint pointed at profiles. Dropping it rather than repointing
-- keeps the rows written by the previous console readable; actor_email is the
-- field the log actually displays.
alter table public.admin_audit
  drop constraint if exists admin_audit_actor_id_fkey;

comment on column public.admin_audit.actor_id is
  'public.admin_users.id for entries written after 0006; public.profiles.id before it.';

/* ------------------------------------------------------------------ */
/* retention — fold the login attempt log into the daily prune         */
/* ------------------------------------------------------------------ */

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

  -- Login attempts are a throttle input for minutes and evidence for weeks.
  delete from public.admin_login_attempts
  where created_at < now() - interval '30 days';

  return v_deleted;
end;
$$;

revoke all on function public.prune_tool_history() from public, anon, authenticated;
grant execute on function public.prune_tool_history() to service_role;
