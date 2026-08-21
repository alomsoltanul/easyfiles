import 'server-only';

import { createSupabaseServerClient } from './supabase/server';
import { PLANS, PLAN_LIST, isPlanId, type Plan, type PlanId } from './plans';
import type { PlanLimits, PlanRow } from './supabase/database.types';

/**
 * Plans as the site should present them right now.
 *
 * src/lib/plans.ts is the type contract and the fallback; the `plans` table is
 * what the admin console edits. The DB wins when it is reachable, so a price
 * change takes effect without a deploy — and the site still renders correct
 * pricing if Supabase is down or not configured yet.
 */

export interface LivePlan extends Plan {
  stripePriceIdMonth: string | null;
  stripePriceIdYear: string | null;
}

function fromRow(row: PlanRow): LivePlan | null {
  if (!isPlanId(row.id)) return null;
  const fallback = PLANS[row.id];

  return {
    id: row.id,
    name: row.name || fallback.name,
    tagline: row.tagline ?? fallback.tagline,
    monthlyPrice: row.monthly_price_cents,
    yearlyPrice: row.yearly_price_cents,
    limits: (row.limits ?? fallback.limits) as PlanLimits,
    features: Array.isArray(row.features) ? row.features : fallback.features,
    sort: row.sort,
    listed: row.listed,
    highlight: fallback.highlight,
    stripePriceIdMonth: row.stripe_price_id_month,
    stripePriceIdYear: row.stripe_price_id_year,
  };
}

function fallbackPlans(): LivePlan[] {
  return PLAN_LIST.map((plan) => ({
    ...plan,
    stripePriceIdMonth: process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_MONTH`] ?? null,
    stripePriceIdYear: process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_YEAR`] ?? null,
  }));
}

export async function getLivePlans(): Promise<LivePlan[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallbackPlans();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('sort', { ascending: true });

  if (error || !data || data.length === 0) return fallbackPlans();

  const mapped = data.map(fromRow).filter((p): p is LivePlan => p !== null);
  return mapped.length > 0 ? mapped : fallbackPlans();
}

export async function getLivePlan(id: PlanId): Promise<LivePlan> {
  const plans = await getLivePlans();
  return plans.find((p) => p.id === id) ?? fallbackPlans().find((p) => p.id === id)!;
}

/** The three plans the pricing page sells, cheapest first. */
export async function getSellablePlans(): Promise<LivePlan[]> {
  return (await getLivePlans()).filter((p) => p.listed).sort((a, b) => a.sort - b.sort);
}
