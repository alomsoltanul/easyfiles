'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  adminGoogleSignInAction,
  adminSignInAction,
  type LoginState,
} from '@/app/(admin)/admin-console/login/actions';

const EMPTY: LoginState = {};

function Submit({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'google' }) {
  const { pending } = useFormStatus();
  const skin =
    variant === 'primary'
      ? 'bg-indigo-500 text-white hover:bg-indigo-400'
      : 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:text-white';

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${skin}`}
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

const field =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

/**
 * Console sign-in. Deliberately terse: no "forgot password", no sign-up, no
 * link back to the site. Console passwords are reset by another owner from the
 * Team screen, which keeps the reset path off the public internet entirely.
 */
export default function AdminLoginForm({
  googleEnabled,
  initialError,
}: {
  googleEnabled: boolean;
  initialError?: string;
}) {
  const [state, submit] = useActionState(adminSignInAction, EMPTY);
  const [googleState, submitGoogle] = useActionState(adminGoogleSignInAction, EMPTY);

  const error = state.error ?? googleState.error ?? initialError;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
          <svg className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 8.5-7 9.9C8 20.5 5 16.5 5 12V7l7-4z" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold text-white">ConvertTools Console</p>
          <p className="text-xs text-slate-500">Staff access only</p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-300"
        >
          {error}
        </p>
      )}

      <form action={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-300">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-300">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={field}
          />
        </label>

        <Submit>Sign in</Submit>
      </form>

      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">or</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <form action={submitGoogle}>
            <Submit variant="google">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.6a4.8 4.8 0 01-2.08 3.15v2.6h3.36C20.85 17.9 22 15.3 22 12.2z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.36-2.6c-.93.62-2.12.99-3.26.99-2.5 0-4.63-1.69-5.39-3.96H3.14v2.48A10 10 0 0012 22z" />
                <path fill="#FBBC05" d="M6.61 14a6 6 0 010-3.83V7.69H3.14a10 10 0 000 8.79L6.61 14z" />
                <path fill="#EA4335" d="M12 6.2c1.41 0 2.67.49 3.67 1.44l2.75-2.75C16.96 3.34 14.7 2.4 12 2.4a10 10 0 00-8.86 5.29l3.47 2.48C7.37 7.9 9.5 6.2 12 6.2z" />
              </svg>
              Continue with Google
            </Submit>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-600">
        Every sign-in attempt is recorded. Repeated failures lock the account out
        for 15 minutes.
      </p>
    </div>
  );
}
