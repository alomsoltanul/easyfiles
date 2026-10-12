'use server';

import { revalidatePath } from 'next/cache';
import { signOut } from '@/lib/admin/auth';
import { writeAdminAudit } from '@/lib/admin/audit';
import { ADMIN_LOGIN_PATH, ADMIN_ROUTE_ROOT } from '@/lib/admin/path';
import { authorize } from '@/lib/admin/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isPlanId } from '@/lib/plans';
import { invalidateToolFlags } from '@/lib/tool-flags';

export interface AdminActionState {
  error?: string;
  notice?: string;
}

const LIVE_STATUSES = ['trialing', 'active', 'past_due'] as const;

function revalidateConsole() {
  // The console is served through a rewrite, so revalidate the real route.
  revalidatePath(ADMIN_ROUTE_ROOT, 'layout');
}

export async function adminSignOutAction(): Promise<void> {
  await signOut({ redirectTo: ADMIN_LOGIN_PATH });
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export async function setUserBanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await authorize('admin');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const userId = String(formData.get('user_id') ?? '');
  const banned = String(formData.get('banned') ?? '') === 'true';
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300);

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      banned_at: banned ? new Date().toISOString() : null,
      ban_reason: banned ? reason || null : null,
    })
    .eq('id', userId);

  if (error) return { error: error.message };

  await writeAdminAudit(actor, banned ? 'user.ban' : 'user.unban', { type: 'user', id: userId }, { reason });
  revalidateConsole();
  return { notice: banned ? 'Account suspended.' : 'Account restored.' };
}

/**
 * Gives a customer a plan without Stripe being involved — for support cases,
 * partners and testing. Marked `comped` so billing pages and the deletion flow
 * know there is no payment to cancel.
 */
export async function grantPlanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await authorize('admin');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const userId = String(formData.get('user_id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  const months = Math.min(Math.max(parseInt(String(formData.get('months') ?? '1'), 10) || 1, 1), 60);
  const note = String(formData.get('note') ?? '').trim().slice(0, 300);

  if (!isPlanId(planId) || planId === 'anon') return { error: 'Choose a real plan.' };

  const admin = getSupabaseAdminClient();

  if (planId === 'free') {
    // "Granting free" means removing whatever comp is in place.
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .eq('comped', true)
      .in('status', [...LIVE_STATUSES]);
    if (error) return { error: error.message };

    await writeAdminAudit(actor, 'user.plan.revoke', { type: 'user', id: userId }, { note });
    revalidateConsole();
    return { notice: 'Complimentary plan removed.' };
  }

  // One live subscription per user; retire any existing one first.
  const { error: clearError } = await admin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('user_id', userId)
    .in('status', [...LIVE_STATUSES]);
  if (clearError) return { error: clearError.message };

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const { error } = await admin.from('subscriptions').insert({
    user_id: userId,
    plan_id: planId,
    interval: months >= 12 ? 'year' : 'month',
    status: 'active',
    current_period_end: periodEnd.toISOString(),
    comped: true,
    // comped_by references profiles; console accounts are not customers, so the
    // person who did it is recorded in the audit log instead.
    comped_by: null,
    comped_note: note || null,
  });

  if (error) return { error: error.message };

  await writeAdminAudit(actor, 'user.plan.grant', { type: 'user', id: userId }, { planId, months, note });
  revalidateConsole();
  return { notice: `${planId} granted for ${months} month${months === 1 ? '' : 's'}.` };
}

/**
 * Clears a customer profile's legacy role='admin'.
 *
 * The flag opens no door in the app any more — console access lives in
 * admin_users — but it still widens what that customer's own Supabase JWT can
 * read through the is_admin() RLS policies, so it is worth clearing.
 */
export async function revokeLegacyRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await authorize('admin');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const userId = String(formData.get('user_id') ?? '');

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('profiles').update({ role: 'user' }).eq('id', userId);
  if (error) return { error: error.message };

  await writeAdminAudit(actor, 'user.legacy_role.revoke', { type: 'user', id: userId });
  revalidateConsole();
  return { notice: 'Elevated database access removed.' };
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export async function setToolFlagAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await authorize('admin');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const slug = String(formData.get('slug') ?? '');
  if (!slug.startsWith('/')) return { error: 'Unknown tool.' };

  const enabled = String(formData.get('enabled') ?? 'true') === 'true';
  const accessRaw = String(formData.get('access') ?? '');
  const access = accessRaw === 'free' || accessRaw === 'pro' ? accessRaw : null;

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('feature_flags').upsert(
    {
      key: `tool:${slug}`,
      enabled,
      payload: (access ? { access } : {}) as never,
    },
    { onConflict: 'key' },
  );

  if (error) return { error: error.message };

  await writeAdminAudit(actor, 'tool.flag.set', { type: 'tool', id: slug }, { enabled, access });

  // Clears this instance's flag cache straight away. Other instances pick the
  // change up within the 60s TTL in tool-flags.ts.
  invalidateToolFlags();
  revalidateConsole();
  revalidatePath(slug);
  return { notice: 'Saved.' };
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export async function updatePlanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const gate = await authorize('admin');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const planId = String(formData.get('plan_id') ?? '');
  if (!isPlanId(planId)) return { error: 'Unknown plan.' };

  const monthly = Math.max(parseInt(String(formData.get('monthly_price') ?? '0'), 10) || 0, 0);
  const yearly = Math.max(parseInt(String(formData.get('yearly_price') ?? '0'), 10) || 0, 0);
  const priceMonth = String(formData.get('stripe_price_id_month') ?? '').trim();
  const priceYear = String(formData.get('stripe_price_id_year') ?? '').trim();

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('plans')
    .update({
      // Cents. The form takes whole cents, the same unit the column stores.
      monthly_price_cents: monthly,
      yearly_price_cents: yearly,
      stripe_price_id_month: priceMonth || null,
      stripe_price_id_year: priceYear || null,
    })
    .eq('id', planId);

  if (error) return { error: error.message };

  await writeAdminAudit(actor, 'plan.update', { type: 'plan', id: planId }, { monthly, yearly });
  revalidateConsole();
  revalidatePath('/pricing');
  return { notice: 'Plan updated.' };
}
