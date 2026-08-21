'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { magicLinkAction, signInAction, type AuthState } from '@/app/account/(auth)/actions';
import { Alert, Divider, Field, SubmitButton } from './primitives';
import OAuthButtons from './OAuthButtons';

const EMPTY: AuthState = {};

export default function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [passwordState, passwordSubmit] = useActionState(signInAction, EMPTY);
  const [magicState, magicSubmit] = useActionState(magicLinkAction, EMPTY);

  const state = mode === 'password' ? passwordState : magicState;

  return (
    <div className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      {mode === 'password' ? (
        <form action={passwordSubmit} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <div>
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
            <Link
              href="/account/forgot"
              className="mt-1.5 inline-block text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Forgot your password?
            </Link>
          </div>
          <SubmitButton>Sign in</SubmitButton>
        </form>
      ) : (
        <form action={magicSubmit} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            hint="We’ll email you a link that signs you in — no password needed."
          />
          <SubmitButton>Email me a link</SubmitButton>
        </form>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
        className="w-full text-center text-[13px] font-semibold text-slate-500 hover:text-slate-800"
      >
        {mode === 'password' ? 'Sign in with an email link instead' : 'Use a password instead'}
      </button>

      <Divider label="or" />
      <OAuthButtons next={next} />

      <p className="text-center text-[13px] text-slate-500">
        No account yet?{' '}
        <Link href="/account/sign-up" className="font-semibold text-emerald-600 hover:text-emerald-700">
          Create one free
        </Link>
      </p>
    </div>
  );
}
