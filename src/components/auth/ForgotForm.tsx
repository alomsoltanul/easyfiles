'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction, type AuthState } from '@/app/account/(auth)/actions';
import { Alert, Field, SubmitButton } from './primitives';

const EMPTY: AuthState = {};

export default function ForgotForm() {
  const [state, submit] = useActionState(forgotPasswordAction, EMPTY);

  return (
    <div className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      <form action={submit} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <SubmitButton>Send reset link</SubmitButton>
      </form>

      <p className="text-center text-[13px] text-slate-500">
        <Link href="/account/sign-in" className="font-semibold text-slate-600 hover:text-slate-900">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
