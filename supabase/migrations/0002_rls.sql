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
-- unless the caller is an admin (or the service role, which skips RLS entirely).
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
