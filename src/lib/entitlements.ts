/**
 * What the current visitor is allowed to do.
 *
 * Reminder, and it is deliberate: 44 of the 56 tools run entirely in the
 * browser, so these checks are a paywall, not a security boundary. The facts
 * they read (plan, usage) come from the server; the enforcement of expensive
 * server work lives in the API routes themselves.
 */

import { PLANS, formatBytes, getPlan, type Plan, type PlanId } from './plans';
import { isProTool } from './tool-access';
import type { PlanLimits } from './supabase/database.types';

export interface UsageToday {
  /** total runs across all tools today, UTC */
  total: number;
  /** runs per tool slug today */
  byTool: Record<string, number>;
  /** runs against the video downloader today */
  video: number;
}

export const EMPTY_USAGE: UsageToday = { total: 0, byTool: {}, video: 0 };

export interface Entitlements {
  signedIn: boolean;
  planId: PlanId;
  plan: Plan;
  limits: PlanLimits;
  usageToday: UsageToday;
}

/** What an anonymous visitor gets. Also the safe fallback on any error. */
export const ANON_ENTITLEMENTS: Entitlements = {
  signedIn: false,
  planId: 'anon',
  plan: PLANS.anon,
  limits: PLANS.anon.limits,
  usageToday: EMPTY_USAGE,
};

export function entitlementsFor(
  planId: string | null | undefined,
  signedIn: boolean,
  usageToday: UsageToday = EMPTY_USAGE,
): Entitlements {
  const plan = getPlan(signedIn ? (planId ?? 'free') : 'anon');
  return { signedIn, planId: plan.id, plan, limits: plan.limits, usageToday };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

export function canUseTool(ent: Entitlements, slug: string): boolean {
  return isProTool(slug) ? ent.limits.proTools : true;
}

/** null means unlimited, so a null limit always passes. */
function withinLimit(value: number, limit: number | null): boolean {
  return limit === null || value <= limit;
}

export function runsRemaining(ent: Entitlements): number | null {
  const { runsPerDay } = ent.limits;
  if (runsPerDay === null) return null;
  return Math.max(0, runsPerDay - ent.usageToday.total);
}

export function videoRunsRemaining(ent: Entitlements): number | null {
  const { videoPerDay } = ent.limits;
  if (videoPerDay === null) return null;
  return Math.max(0, videoPerDay - ent.usageToday.video);
}

export type DenyReason =
  | 'pro-tool'
  | 'file-too-large'
  | 'batch-too-large'
  | 'daily-limit'
  | 'video-daily-limit';

export interface GateResult {
  ok: boolean;
  reason?: DenyReason;
  /** user-facing copy, already mentions the limit that was hit */
  message?: string;
  /** the plan that would clear this block */
  upgradeTo?: PlanId;
}

const OK: GateResult = { ok: true };

/**
 * The single check a tool runs before doing work: tool access, file sizes,
 * batch size, and the daily quota, in the order a user would hit them.
 */
export function checkRun(
  ent: Entitlements,
  slug: string,
  files: { size: number }[] = [],
): GateResult {
  if (!canUseTool(ent, slug)) {
    return {
      ok: false,
      reason: 'pro-tool',
      message: 'This tool is part of the paid plans.',
      upgradeTo: 'starter',
    };
  }

  const { maxFileBytes, maxBatch } = ent.limits;

  if (!withinLimit(files.length, maxBatch)) {
    return {
      ok: false,
      reason: 'batch-too-large',
      message: `Your plan handles ${maxBatch} files at a time. You picked ${files.length}.`,
      upgradeTo: nextPlanAfter(ent.planId),
    };
  }

  const oversize = files.find((f) => !withinLimit(f.size, maxFileBytes));
  if (oversize) {
    return {
      ok: false,
      reason: 'file-too-large',
      message: `Your plan takes files up to ${formatBytes(maxFileBytes)}. That one is ${formatBytes(oversize.size)}.`,
      upgradeTo: nextPlanAfter(ent.planId),
    };
  }

  const remaining = runsRemaining(ent);
  if (remaining !== null && remaining <= 0) {
    return {
      ok: false,
      reason: 'daily-limit',
      message: `You have used all ${ent.limits.runsPerDay} runs for today.`,
      upgradeTo: nextPlanAfter(ent.planId),
    };
  }

  if (slug.startsWith('/video')) {
    const videoLeft = videoRunsRemaining(ent);
    if (videoLeft !== null && videoLeft <= 0) {
      return {
        ok: false,
        reason: 'video-daily-limit',
        message: `You have used all ${ent.limits.videoPerDay} video downloads for today.`,
        upgradeTo: nextPlanAfter(ent.planId),
      };
    }
  }

  return OK;
}

/** The cheapest plan that is strictly better than the current one. */
export function nextPlanAfter(planId: PlanId): PlanId {
  switch (planId) {
    case 'anon':
      return 'free';
    case 'free':
      return 'starter';
    case 'starter':
      return 'pro';
    default:
      return 'business';
  }
}
