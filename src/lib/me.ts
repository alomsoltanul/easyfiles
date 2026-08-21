/**
 * Shape of GET /api/me, shared by the route and the client hook.
 *
 * The header, the tool gates and the upload limits all read from one request
 * per page load, cached at module scope in useEntitlements().
 */

import type { PlanId } from './plans';
import type { UsageToday } from './entitlements';
import type { BillingInterval, PlanLimits, SubscriptionStatus } from './supabase/database.types';

export interface MeUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface MeSubscription {
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface MeResponse {
  signedIn: boolean;
  user: MeUser | null;
  planId: PlanId;
  planName: string;
  limits: PlanLimits;
  usageToday: UsageToday;
  subscription: MeSubscription | null;
  /**
   * The secret admin path, sent only to admins. ADMIN_PATH_SECRET is a
   * server-only variable, so the browser has no other way to build this link.
   */
  adminPath: string | null;
}
