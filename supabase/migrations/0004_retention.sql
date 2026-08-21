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
