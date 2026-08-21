'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type AuthState } from '@/app/account/(auth)/actions';
import { Alert, Field, SubmitButton } from './primitives';

const EMPTY: AuthState = {};

export default function ResetForm() {
  const [state, submit] = useActionState(resetPasswordAction, EMPTY);

  return (
    <div className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <form action={submit} className="space-y-4">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
        />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton>Update password</SubmitButton>
      </form>
    </div>
  );
}
