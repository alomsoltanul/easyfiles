import 'server-only';

import { headers } from 'next/headers';
import { requireAdmin } from './auth';
import { getSupabaseAdminClient } from './supabase/admin';
import type {
  AdminAudit,
  PlanLimits,
  PlanRow,
  Profile,
  SubscriptionRow,
  SubscriptionStatus,
  ToolRun,
} from './supabase/database.types';

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
];

function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as string[]).includes(value);
}

/**
 * Data layer for the admin console.
 *
 * Every function re-checks requireAdmin() rather than trusting the layout — the
 * service-role client below bypasses RLS entirely, so the authorisation has to
 * live next to the query, not two files away.
 */

export const ADMIN_PAGE_SIZE = 25;

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export async function writeAudit(
  action: string,
  target: { type: string; id: string },
  meta: Record<string, unknown> = {},
): Promise<void> {
  const { user, profile } = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const headerList = await headers();
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    null;

  await admin.from('admin_audit').insert({
    actor_id: user.id,
    actor_email: profile.email,
    action,
    target_type: target.type,
    target_id: target.id,
    meta: meta as never,
    ip,
  });
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface AdminOverview {
  users: number;
  newUsers7d: number;
  activeSubs: number;
  mrrCents: number;
  runsToday: number;
  runs30d: number;
  failures30d: number;
  /** [YYYY-MM-DD, runs] oldest first, 30 entries */
  series: { day: string; runs: number }[];
  planCounts: { planId: string; count: number }[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const since7 = new Date(now.getTime() - 7 * 86_400_000);

  const [usersRes, new7Res, subsRes, plansRes, runsTodayRes, runs30Res] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7.toISOString()),
    admin
      .from('subscriptions')
      .select('plan_id, interval, status')
      .in('status', ['trialing', 'active', 'past_due']),
    admin.from('plans').select('*'),
    admin
      .from('usage_daily')
      .select('runs')
      .eq('day', today),
    admin
      .from('tool_runs')
      .select('created_at, status')
      .gte('created_at', since30.toISOString()),
  ]);

  const plans = (plansRes.data ?? []) as PlanRow[];
  const priceOf = (planId: string, interval: string): number => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return 0;
    // Normalise a yearly price to a monthly figure so MRR is comparable.
    return interval === 'year'
      ? Math.round(plan.yearly_price_cents / 12)
      : plan.monthly_price_cents;
  };

  const subs = subsRes.data ?? [];
  const mrrCents = subs.reduce((sum, s) => sum + priceOf(s.plan_id, s.interval), 0);

  const planCounts = Object.entries(
    subs.reduce<Record<string, number>>((acc, s) => {
      acc[s.plan_id] = (acc[s.plan_id] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([planId, count]) => ({ planId, count }));

  const runsToday = (runsTodayRes.data ?? []).reduce((sum, r) => sum + r.runs, 0);

  const runs30 = runs30Res.data ?? [];
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    byDay.set(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10), 0);
  }
  let failures = 0;
  for (const row of runs30) {
    const day = row.created_at.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (row.status === 'error') failures += 1;
  }

  return {
    users: usersRes.count ?? 0,
    newUsers7d: new7Res.count ?? 0,
    activeSubs: subs.length,
    mrrCents,
    runsToday,
    runs30d: runs30.length,
    failures30d: failures,
    series: [...byDay.entries()].map(([day, runs]) => ({ day, runs })),
    planCounts,
  };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface AdminUserRow extends Profile {
  plan_id: string;
  sub_status: string | null;
}

export interface UserQuery {
  q?: string;
  plan?: string;
  role?: string;
  page?: number;
}

export async function listUsers(
  query: UserQuery = {},
): Promise<{ users: AdminUserRow[]; total: number }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const page = Math.max(query.page ?? 1, 1);
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  let request = admin
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, '')}%`;
    request = request.or(`email.ilike.${term},full_name.ilike.${term}`);
  }
  if (query.role === 'admin') request = request.eq('role', 'admin');

  const { data, count, error } = await request;
  if (error || !data) return { users: [], total: 0 };

  const ids = data.map((p) => p.id);
  const { data: subs } = ids.length
    ? await admin
        .from('subscriptions')
        .select('user_id, plan_id, status')
        .in('user_id', ids)
        .in('status', ['trialing', 'active', 'past_due'])
    : { data: [] };

  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

  let users: AdminUserRow[] = data.map((profile) => {
    const sub = subByUser.get(profile.id);
    return { ...profile, plan_id: sub?.plan_id ?? 'free', sub_status: sub?.status ?? null };
  });

  // Plan lives on a different table, so this filter runs after the join rather
  // than in the query. Fine at this scale; revisit if the user table grows.
  if (query.plan) users = users.filter((u) => u.plan_id === query.plan);

  return { users, total: count ?? 0 };
}

export interface AdminUserDetail {
  profile: Profile;
  subscription: SubscriptionRow | null;
  recentRuns: ToolRun[];
  runCount: number;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const [{ data: profile }, { data: subscription }, { data: runs, count }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('tool_runs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  if (!profile) return null;

  return {
    profile,
    subscription: subscription ?? null,
    recentRuns: runs ?? [],
    runCount: count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export interface AdminSubRow extends SubscriptionRow {
  email: string | null;
}

export async function listSubscriptions(
  query: { status?: string; page?: number } = {},
): Promise<{ subs: AdminSubRow[]; total: number }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const page = Math.max(query.page ?? 1, 1);
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  let request = admin
    .from('subscriptions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  // The column is a Postgres enum, so only a known value is worth querying —
  // anything else would error rather than return an empty list.
  if (query.status && isSubscriptionStatus(query.status)) {
    request = request.eq('status', query.status);
  }

  const { data, count, error } = await request;
  if (error || !data) return { subs: [], total: 0 };

  const ids = [...new Set(data.map((s) => s.user_id))];
  const { data: profiles } = ids.length
    ? await admin.from('profiles').select('id, email').in('id', ids)
    : { data: [] };

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return {
    subs: data.map((sub) => ({ ...sub, email: emailById.get(sub.user_id) ?? null })),
    total: count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Plans and tool flags                                                */
/* ------------------------------------------------------------------ */

export async function listPlanRows(): Promise<PlanRow[]> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from('plans').select('*').order('sort', { ascending: true });
  return data ?? [];
}

export interface ToolFlag {
  key: string;
  enabled: boolean;
  access: 'free' | 'pro' | null;
}

export async function listToolFlags(): Promise<Map<string, ToolFlag>> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from('feature_flags').select('*').like('key', 'tool:%');

  const map = new Map<string, ToolFlag>();
  for (const row of data ?? []) {
    const payload = (row.payload ?? {}) as { access?: 'free' | 'pro' };
    map.set(row.key.slice('tool:'.length), {
      key: row.key,
      enabled: row.enabled,
      access: payload.access ?? null,
    });
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Usage analytics                                                     */
/* ------------------------------------------------------------------ */

export interface ToolUsageRow {
  slug: string;
  label: string;
  dept: string;
  runs: number;
  failures: number;
  bytes: number;
}

export async function getToolUsage(days = 30): Promise<ToolUsageRow[]> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await admin
    .from('tool_runs')
    .select('tool_slug, label, dept, status, input_bytes')
    .gte('created_at', since);

  const rows = new Map<string, ToolUsageRow>();
  for (const run of data ?? []) {
    const existing = rows.get(run.tool_slug) ?? {
      slug: run.tool_slug,
      label: run.label ?? run.tool_slug,
      dept: run.dept,
      runs: 0,
      failures: 0,
      bytes: 0,
    };
    existing.runs += 1;
    if (run.status === 'error') existing.failures += 1;
    existing.bytes += run.input_bytes;
    rows.set(run.tool_slug, existing);
  }

  return [...rows.values()].sort((a, b) => b.runs - a.runs);
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export async function listAudit(page = 1): Promise<{ entries: AdminAudit[]; total: number }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const from = (Math.max(page, 1) - 1) * ADMIN_PAGE_SIZE;
  const { data, count } = await admin
    .from('admin_audit')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  return { entries: data ?? [], total: count ?? 0 };
}

export type { PlanLimits };
