'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/site';

export interface AuthState {
  error?: string;
  notice?: string;
}

const GENERIC_UNAVAILABLE = 'Accounts are not available right now. Please try again later.';

/** Only allow same-site relative paths back from ?next= — never an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
  };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: GENERIC_UNAVAILABLE };

  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: 'Enter your email and password.' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // hands an attacker a way to enumerate accounts.
    return { error: 'That email and password do not match an account.' };
  }

  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next')));
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: GENERIC_UNAVAILABLE };

  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email) return { error: 'Enter your email address.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

  const next = safeNext(formData.get('next'));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) return { error: error.message };

  // With email confirmation on, no session comes back and the user has to click
  // the link first. With it off, they are signed in already.
  if (!data.session) {
    return { notice: `Check ${email} for a link to confirm your account.` };
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function magicLinkAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: GENERIC_UNAVAILABLE };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Enter your email address.' };

  const next = safeNext(formData.get('next'));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
  });

  if (error) return { error: error.message };
  return { notice: `Check ${email} for your sign-in link.` };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: GENERIC_UNAVAILABLE };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Enter your email address.' };

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl('/auth/callback?next=/account/reset'),
  });

  // Always the same answer, whether or not the address exists.
  return { notice: 'If that address has an account, a reset link is on its way.' };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: GENERIC_UNAVAILABLE };

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/account?reset=1');
}

export async function oauthAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/account/sign-in?error=unavailable');

  const provider = String(formData.get('provider') ?? 'google') as 'google' | 'github';
  const next = safeNext(formData.get('next'));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
  });

  if (error || !data.url) redirect('/account/sign-in?error=oauth');
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
