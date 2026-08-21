/**
 * Plan definitions — the compile-time source of truth.
 *
 * The `plans` table in Supabase mirrors this (see supabase/migrations/0003_seed_plans.sql)
 * so the admin console can change prices and limits without a deploy. At runtime the
 * DB row wins when present; this file is the fallback and the type contract.
 */

import type { PlanLimits } from './supabase/database.types';

export type PlanId = 'anon' | 'free' | 'starter' | 'pro' | 'business';

/** Plans a visitor can actually buy. */
export const PAID_PLAN_IDS = ['starter', 'pro', 'business'] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export type BillingInterval = 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** cents */
  monthlyPrice: number;
  yearlyPrice: number;
  limits: PlanLimits;
  features: string[];
  sort: number;
  /** shown on the pricing page */
  listed: boolean;
  /** visually emphasised card */
  highlight?: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLANS: Record<PlanId, Plan> = {
  anon: {
    id: 'anon',
    name: 'Anonymous',
    tagline: 'No account needed',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      maxFileBytes: 25 * MB,
      maxBatch: 3,
      runsPerDay: 10,
      videoPerDay: 2,
      historyDays: 0,
      seats: 0,
      api: false,
      proTools: false,
    },
    features: ['44 free tools', 'No sign-up required', 'Files never leave your browser'],
    sort: 0,
    listed: false,
  },
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Save your history',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      maxFileBytes: 50 * MB,
      maxBatch: 5,
      runsPerDay: 30,
      videoPerDay: 5,
      historyDays: 30,
      seats: 1,
      api: false,
      proTools: false,
    },
    features: ['44 free tools', '30 days of saved history', '50 MB files', '30 runs per day'],
    sort: 1,
    listed: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For occasional heavy files',
    monthlyPrice: 400,
    yearlyPrice: 3900,
    limits: {
      maxFileBytes: 100 * MB,
      maxBatch: 20,
      runsPerDay: 500,
      videoPerDay: 30,
      historyDays: 365,
      seats: 1,
      api: false,
      proTools: true,
    },
    features: [
      'All 56 tools',
      '100 MB files',
      '20 files per batch',
      '500 runs per day',
      '1 year of history',
      '30 video downloads per day',
    ],
    sort: 2,
    listed: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For daily document work',
    monthlyPrice: 900,
    yearlyPrice: 8900,
    limits: {
      maxFileBytes: 500 * MB,
      maxBatch: 100,
      runsPerDay: null,
      videoPerDay: 100,
      historyDays: null,
      seats: 1,
      api: true,
      proTools: true,
    },
    features: [
      'All 56 tools',
      '500 MB files',
      '100 files per batch',
      'Unlimited runs',
      'History kept forever',
      '100 video downloads per day',
      'API access',
    ],
    sort: 3,
    listed: true,
    highlight: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'For teams',
    monthlyPrice: 2900,
    yearlyPrice: 28900,
    limits: {
      maxFileBytes: 2 * GB,
      maxBatch: null,
      runsPerDay: null,
      videoPerDay: 300,
      historyDays: null,
      seats: 5,
      api: true,
      proTools: true,
    },
    features: [
      'All 56 tools',
      '2 GB files',
      'Unlimited batch size',
      'Unlimited runs',
      'History kept forever',
      '300 video downloads per day',
      'API access',
      '5 seats',
    ],
    sort: 4,
    listed: true,
  },
};

export const PLAN_LIST = Object.values(PLANS).sort((a, b) => a.sort - b.sort);
export const LISTED_PLANS = PLAN_LIST.filter((p) => p.listed);

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export function getPlan(id: string | null | undefined): Plan {
  return id && isPlanId(id) ? PLANS[id] : PLANS.anon;
}

/** Cents for the chosen interval. */
export function priceFor(plan: Plan, interval: BillingInterval): number {
  return interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
}

/** What a yearly plan works out to per month, in cents — used on the pricing cards. */
export function monthlyEquivalent(plan: Plan): number {
  return Math.round(plan.yearlyPrice / 12);
}

/** Whole-percent discount of yearly against 12x monthly. */
export function yearlySavingsPercent(plan: Plan): number {
  if (plan.monthlyPrice <= 0) return 0;
  const full = plan.monthlyPrice * 12;
  return Math.round(((full - plan.yearlyPrice) / full) * 100);
}

/** `400` -> `$4`, `3900` -> `$39`, `450` -> `$4.50` */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unlimited';
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}

export function formatLimit(value: number | null, unit = ''): string {
  if (value === null) return 'Unlimited';
  return unit ? `${value} ${unit}` : String(value);
}
