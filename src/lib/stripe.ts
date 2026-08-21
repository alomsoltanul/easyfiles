import 'server-only';

import Stripe from 'stripe';
import type { BillingInterval, PlanId } from './plans';
import type { LivePlan } from './plan-source';
import type { SubscriptionStatus } from './supabase/database.types';

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    // Pinning nothing means the account's default API version, which is what
    // the dashboard and the webhook payloads use too.
    cached = new Stripe(key);
  }
  return cached;
}

/** The price to charge for a plan on a given interval. */
export function priceIdFor(plan: LivePlan, interval: BillingInterval): string | null {
  return interval === 'year' ? plan.stripePriceIdYear : plan.stripePriceIdMonth;
}

/** Reverse lookup used by the webhook to name the plan a subscription is for. */
export function planIdForPrice(plans: LivePlan[], priceId: string): PlanId | null {
  for (const plan of plans) {
    if (plan.stripePriceIdMonth === priceId || plan.stripePriceIdYear === priceId) return plan.id;
  }
  return null;
}

export function intervalForPrice(plans: LivePlan[], priceId: string): BillingInterval {
  for (const plan of plans) {
    if (plan.stripePriceIdYear === priceId) return 'year';
  }
  return 'month';
}

/**
 * Stripe's status strings map one-to-one onto our enum, but the column is a
 * Postgres enum — an unrecognised value would fail the insert, so anything
 * unexpected is stored as 'incomplete' rather than losing the whole row.
 */
export function toSubscriptionStatus(status: string): SubscriptionStatus {
  const known: SubscriptionStatus[] = [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused',
  ];
  return known.includes(status as SubscriptionStatus) ? (status as SubscriptionStatus) : 'incomplete';
}
