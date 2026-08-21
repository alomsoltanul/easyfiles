'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { writeAudit } from '@/lib/admin-data';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isPlanId } from '@/lib/plans';
import { invalidateToolFlags } from '@/lib/tool-flags';
import { adminHref } from '@/lib/admin-path';

export interface AdminActionState {
  error?: string;
  notice?: string;
}

const LIVE_STATUSES = ['trialing', 'active', 'past_due'] as const;

function revalidateConsole() {
  // The console is served through a rewrite, so revalidate the real route.
  revalidatePath('/console', 'layout');
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function setUserRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');

  if (role !== 'user' && role !== 'admin') return { error: 'Unknown role.' };
  if (userId === actor.user.id) {
    // Removing your own admin rights locks you out of a URL you may not be able
    // to reach again without database access.
    return { error: 'You cannot change your own role.' };
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: error.message };

  await writeAudit('user.role.change', { type: 'user', id: userId }, { role });
  revalidateConsole();
  return { notice: `Role set to ${role}.` };
}

export async function setUserBanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const userId = String(formData.get('user_id') ?? '');
  const banned = String(formData.get('banned') ?? '') === 'true';
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300);

  if (userId === actor.user.id) return { error: 'You cannot ban yourself.' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      banned_at: banned ? new Date().toISOString() : null,
      ban_reason: banned ? reason || null : null,
    })
    .eq('id', userId);

  if (error) return { error: error.message };

  await writeAudit(banned ? 'user.ban' : 'user.unban', { type: 'user', id: userId }, { reason });
  revalidateConsole();
  return { notice: banned ? 'Account suspended.' : 'Account restored.' };
}

/**
 * Gives a user a plan without Stripe being involved — for support cases,
 * partners and testing. Marked `comped` so billing pages and the deletion flow
 * know there is no payment to cancel.
 */
export async function grantPlanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireAdmin();
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

    await writeAudit('user.plan.revoke', { type: 'user', id: userId }, { note });
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
    comped_by: actor.user.id,
    comped_note: note || null,
  });

  if (error) return { error: error.message };

  await writeAudit('user.plan.grant', { type: 'user', id: userId }, { planId, months, note });
  revalidateConsole();
  return { notice: `${planId} granted for ${months} month${months === 1 ? '' : 's'}.` };
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export async function setToolFlagAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

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

  await writeAudit('tool.flag.set', { type: 'tool', id: slug }, { enabled, access });

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
  await requireAdmin();

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
      // Cents. The form takes whole currency units, converted on the way in.
      monthly_price_cents: monthly,
      yearly_price_cents: yearly,
      stripe_price_id_month: priceMonth || null,
      stripe_price_id_year: priceYear || null,
    })
    .eq('id', planId);

  if (error) return { error: error.message };

  await writeAudit('plan.update', { type: 'plan', id: planId }, { monthly, yearly });
  revalidateConsole();
  revalidatePath('/pricing');
  return { notice: 'Plan updated.' };
}

/** Used by the console nav to build links through the secret path. */
export async function consoleHref(subpath: string): Promise<string> {
  return adminHref(subpath);
}
