import 'server-only';

import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase/server';
import type { Profile, SubscriptionRow } from './supabase/database.types';
import {
  ANON_ENTITLEMENTS,
  EMPTY_USAGE,
  entitlementsFor,
  type Entitlements,
  type UsageToday,
} from './entitlements';

export const SIGN_IN_PATH = '/account/sign-in';

/** Statuses that still entitle a user to their plan. */
const LIVE_STATUSES = ['trialing', 'active', 'past_due'] as const;

export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  // getUser() revalidates the JWT against Supabase; getSession() alone trusts
  // a cookie the client could have written.
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export interface Account {
  user: User;
  profile: Profile;
  subscription: SubscriptionRow | null;
}

export async function getAccount(): Promise<Account | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userData.user.id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .in('status', [...LIVE_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile) return null;

  return { user: userData.user, profile, subscription: subscription ?? null };
}

async function getUsageToday(userId: string): Promise<UsageToday> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY_USAGE;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('usage_daily')
    .select('tool_slug, runs')
    .eq('user_id', userId)
    .eq('day', today);

  if (error || !data) return EMPTY_USAGE;

  const usage: UsageToday = { total: 0, byTool: {}, video: 0 };
  for (const row of data) {
    usage.total += row.runs;
    usage.byTool[row.tool_slug] = (usage.byTool[row.tool_slug] ?? 0) + row.runs;
    if (row.tool_slug.startsWith('/video')) usage.video += row.runs;
  }
  return usage;
}

/**
 * Everything a gate needs, in one call. Falls back to anonymous entitlements
 * whenever Supabase is unconfigured, the session is missing, or the account is
 * banned — the 44 free tools keep working in every one of those cases.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const account = await getAccount();
  if (!account || account.profile.banned_at) return ANON_ENTITLEMENTS;

  const usage = await getUsageToday(account.user.id);
  const planId = account.subscription?.plan_id ?? 'free';
  return entitlementsFor(planId, true, usage);
}

/** For pages under /account — bounces to sign-in and comes back afterwards. */
export async function requireUser(returnTo?: string): Promise<Account> {
  const account = await getAccount();
  if (!account) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    redirect(`${SIGN_IN_PATH}${next}`);
  }
  if (account.profile.banned_at) {
    redirect('/account/suspended');
  }
  return account;
}

/**
 * For the admin console. Renders the custom 404 rather than a 403 — a 403
 * would confirm to a prober that the secret path exists.
 */
export async function requireAdmin(): Promise<Account> {
  const account = await getAccount();
  if (!account || account.profile.role !== 'admin' || account.profile.banned_at) {
    notFound();
  }
  return account;
}

export async function isAdmin(): Promise<boolean> {
  const account = await getAccount();
  return Boolean(account && account.profile.role === 'admin' && !account.profile.banned_at);
}
