'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUpAction, type AuthState } from '@/app/account/(auth)/actions';
import { Alert, Divider, Field, SubmitButton } from './primitives';
import OAuthButtons from './OAuthButtons';

const EMPTY: AuthState = {};

export default function SignUpForm({ next }: { next: string }) {
  const [state, submit] = useActionState(signUpAction, EMPTY);

  return (
    <div className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      <form action={submit} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Name" name="full_name" autoComplete="name" placeholder="Optional" />
        <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
        />
        <SubmitButton>Create free account</SubmitButton>
      </form>

      <Divider label="or" />
      <OAuthButtons next={next} />

      <p className="text-center text-[13px] text-slate-500">
        Already have an account?{' '}
        <Link href="/account/sign-in" className="font-semibold text-emerald-600 hover:text-emerald-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
