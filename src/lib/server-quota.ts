import 'server-only';

import { getEntitlements } from './auth';
import { videoRunsRemaining } from './entitlements';
import { getPlan } from './plans';

export interface QuotaVerdict {
  ok: boolean;
  message?: string;
  code?: string;
}

const OK: QuotaVerdict = { ok: true };

/**
 * Real server-side enforcement for the video endpoints.
 *
 * The browser-side gates on the 44 client tools are a paywall, not a boundary —
 * but these routes spend our CPU and bandwidth, so the limit has to hold here
 * regardless of what the client claims.
 *
 * Anonymous callers are held to the anon allowance. Their usage is not tracked
 * per person (there is no account to track), so the IP rate limiter in
 * video-security.ts is what bounds them; this function stops a signed-in user
 * from exceeding the plan they pay for.
 */
export async function checkVideoQuota(): Promise<QuotaVerdict> {
  const entitlements = await getEntitlements();

  if (!entitlements.signedIn) return OK;

  const remaining = videoRunsRemaining(entitlements);
  if (remaining !== null && remaining <= 0) {
    const plan = getPlan(entitlements.planId);
    return {
      ok: false,
      code: 'PLAN_LIMIT',
      message: `Your ${plan.name} plan allows ${plan.limits.videoPerDay} video downloads a day. The counter resets at midnight UTC.`,
    };
  }

  return OK;
}
