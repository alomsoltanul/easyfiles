import { NextResponse } from 'next/server';
import { getAccount, getEntitlements } from '@/lib/auth';
import { ANON_ENTITLEMENTS } from '@/lib/entitlements';
import type { MeResponse } from '@/lib/me';

export const dynamic = 'force-dynamic';

/**
 * Everything the browser needs to decide what to show and what to allow.
 *
 * Client components read this instead of holding plan state locally, so a
 * downgrade or an admin change takes effect on the next page load rather than
 * whenever some cached value happens to expire.
 *
 * Nothing about the admin console appears here. Console accounts are a separate
 * system with a separate session, so a customer response has nothing to say
 * about it — not even to an admin who happens to also be a customer.
 */
export async function GET() {
  const [account, entitlements] = await Promise.all([getAccount(), getEntitlements()]);

  const body: MeResponse = account
    ? {
        signedIn: true,
        user: {
          id: account.user.id,
          email: account.profile.email,
          fullName: account.profile.full_name,
          avatarUrl: account.profile.avatar_url,
        },
        planId: entitlements.planId,
        planName: entitlements.plan.name,
        limits: entitlements.limits,
        usageToday: entitlements.usageToday,
        subscription: account.subscription
          ? {
              status: account.subscription.status,
              interval: account.subscription.interval,
              currentPeriodEnd: account.subscription.current_period_end,
              cancelAtPeriodEnd: account.subscription.cancel_at_period_end,
            }
          : null,
      }
    : {
        signedIn: false,
        user: null,
        planId: ANON_ENTITLEMENTS.planId,
        planName: ANON_ENTITLEMENTS.plan.name,
        limits: ANON_ENTITLEMENTS.limits,
        usageToday: ANON_ENTITLEMENTS.usageToday,
        subscription: null,
      };

  return NextResponse.json(body, {
    // Per-user and cheap; caching it anywhere shared would leak one user's plan
    // into another user's page.
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
