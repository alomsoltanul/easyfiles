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
