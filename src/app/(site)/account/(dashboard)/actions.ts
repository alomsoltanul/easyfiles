'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAccount } from '@/lib/auth';
import { clearHistory } from '@/lib/account-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface SettingsState {
  error?: string;
  notice?: string;
}

export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const account = await getAccount();
  if (!account) return { error: 'You are signed out. Sign in and try again.' };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Not available right now.' };

  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 120);

  // Only name and avatar are writable here; the guard trigger in 0002_rls.sql
  // rejects any attempt to touch role or ban columns from a user session.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName || null })
    .eq('id', account.user.id);

  if (error) return { error: error.message };

  revalidatePath('/account', 'layout');
  return { notice: 'Saved.' };
}

export async function changePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Not available right now.' };

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { notice: 'Password updated.' };
}

export async function clearHistoryAction(): Promise<SettingsState> {
  const account = await getAccount();
  if (!account) return { error: 'You are signed out. Sign in and try again.' };

  const ok = await clearHistory(account.user.id);
  if (!ok) return { error: 'Could not clear your history. Try again.' };

  revalidatePath('/account', 'layout');
  return { notice: 'History cleared.' };
}

/**
 * Permanent account deletion, requested by the account holder.
 *
 * Deleting the auth.users row cascades through profiles and everything keyed to
 * it — history, usage counters, subscription records. Any live Stripe
 * subscription must be cancelled first, or they keep being billed for an
 * account that no longer exists.
 */
export async function deleteAccountAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const account = await getAccount();
  if (!account) return { error: 'You are signed out. Sign in and try again.' };

  const confirmation = String(formData.get('confirm_email') ?? '').trim().toLowerCase();
  if (confirmation !== account.profile.email.toLowerCase()) {
    return { error: 'Type your email address exactly to confirm.' };
  }

  if (account.subscription && !account.subscription.comped) {
    return {
      error:
        'Cancel your subscription on the billing page first — deleting the account will not stop the charges.',
    };
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { error: 'Account deletion is not configured. Contact support.' };
  }

  const { error } = await admin.auth.admin.deleteUser(account.user.id);
  if (error) return { error: error.message };

  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/?deleted=1');
}
