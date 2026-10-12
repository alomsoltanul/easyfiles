'use server';

import { AuthError, CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/admin/auth';
import { ADMIN_PATH } from '@/lib/admin/path';

export interface LoginState {
  error?: string;
}

/**
 * Only two things a stranger is told apart: "that did not work" and "you have
 * tried too often". Everything else — unknown email, disabled account, Google
 * account without a password — reads the same, so the form cannot be used to
 * discover which addresses have console access. The real reason goes to
 * admin_login_attempts, which only a signed-in admin can read.
 */
function messageFor(code: string | undefined): string {
  switch (code) {
    case 'throttled':
      return 'Too many attempts. Try again in about 15 minutes.';
    case 'AccessDenied':
      return 'That account has no console access.';
    case 'OAuthAccountNotLinked':
      return 'That Google account is not linked to a console account.';
    default:
      return 'Email or password is wrong.';
  }
}

/**
 * Pulls the specific reason out of whatever Auth.js hands back.
 *
 * It reports a failure two different ways depending on how it was called. Over
 * HTTP it redirects to `pages.error` with ?error=&code=. Called in-process from
 * a Server Action — which is how sign-in runs here — it throws instead, and the
 * useful part is `code` on the CredentialsSignin subclass; `type` is always the
 * generic "CredentialsSignin" and would lose the distinction between a wrong
 * password and a locked-out account.
 */
function codeFrom(error: AuthError): string {
  return error instanceof CredentialsSignin ? error.code : error.type;
}

/** For the redirect-shaped failure: a returned URL carrying ?error=. */
function failureFrom(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    const error = parsed.searchParams.get('error');
    if (!error) return null;
    return messageFor(parsed.searchParams.get('code') ?? error);
  } catch {
    return null;
  }
}

export async function adminSignInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };

  let destination: string;
  try {
    // redirect:false keeps the failure path inside this action, where the form
    // can render the message. The session cookie is still set on success.
    destination = await signIn('credentials', {
      email,
      password,
      redirect: false,
      redirectTo: ADMIN_PATH,
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: messageFor(codeFrom(err)) };
    throw err;
  }

  const failure = failureFrom(destination);
  if (failure) return { error: failure };

  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  redirect(destination);
}

export async function adminGoogleSignInAction(_prev: LoginState): Promise<LoginState> {
  let destination: string;
  try {
    destination = await signIn('google', { redirect: false, redirectTo: ADMIN_PATH });
  } catch (err) {
    if (err instanceof AuthError) return { error: messageFor(codeFrom(err)) };
    throw err;
  }

  const failure = failureFrom(destination);
  if (failure) return { error: failure };

  redirect(destination);
}
