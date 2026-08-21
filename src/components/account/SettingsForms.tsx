'use client';

import { useActionState, useState } from 'react';
import {
  changePasswordAction,
  clearHistoryAction,
  deleteAccountAction,
  updateProfileAction,
  type SettingsState,
} from '@/app/account/(dashboard)/actions';
import { Alert, Field, SubmitButton } from '@/components/auth/primitives';

const EMPTY: SettingsState = {};

function Card({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 sm:p-6 ${
        tone === 'danger' ? 'border-rose-200' : 'border-slate-200'
      }`}
    >
      <h2 className={`text-sm font-bold ${tone === 'danger' ? 'text-rose-700' : 'text-slate-800'}`}>
        {title}
      </h2>
      <p className="mt-1 mb-4 text-[13px] leading-relaxed text-slate-500">{description}</p>
      {children}
    </section>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, submit] = useActionState(updateProfileAction, EMPTY);

  return (
    <Card title="Your details" description="The name shown in your account menu.">
      <form action={submit} className="max-w-sm space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.notice && <Alert tone="notice">{state.notice}</Alert>}
        <Field label="Name" name="full_name" defaultValue={fullName} placeholder="Your name" />
        <Field
          label="Email"
          name="email_readonly"
          defaultValue={email}
          hint="Contact support to change the address on your account."
        />
        <SubmitButton>Save</SubmitButton>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, submit] = useActionState(changePasswordAction, EMPTY);

  return (
    <Card
      title="Password"
      description="Changing this signs you out of other browsers the next time they refresh."
    >
      <form action={submit} className="max-w-sm space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.notice && <Alert tone="notice">{state.notice}</Alert>}
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
    </Card>
  );
}

export function HistoryControls({ runCount }: { runCount: number }) {
  const [state, submit] = useActionState(
    async (_prev: SettingsState) => clearHistoryAction(),
    EMPTY,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <Card
      title="Tool history"
      description={`${runCount} run${runCount === 1 ? '' : 's'} recorded. Clearing removes every entry — the files themselves were never stored.`}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      {confirming ? (
        <form action={submit} className="flex max-w-sm items-center gap-2">
          <SubmitButton>Yes, clear it all</SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={runCount === 0}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear history
        </button>
      )}
    </Card>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, submit] = useActionState(deleteAccountAction, EMPTY);
  const [open, setOpen] = useState(false);

  return (
    <Card
      tone="danger"
      title="Delete account"
      description="This removes your account, your history and your usage records. It cannot be undone."
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {open ? (
        <form action={submit} className="max-w-sm space-y-4">
          <Field
            label="Type your email to confirm"
            name="confirm_email"
            placeholder={email}
            required
            autoComplete="off"
          />
          <div className="flex items-center gap-2">
            <SubmitButton>Delete my account</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          Delete account
        </button>
      )}
    </Card>
  );
}
