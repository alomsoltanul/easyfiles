'use client';

import { useActionState } from 'react';
import {
  changeOwnPasswordAction,
  createAdminAction,
  resetAdminPasswordAction,
  setAdminDisabledAction,
  setAdminRoleAction,
  type TeamActionState,
} from '@/app/(admin)/admin-console/(dashboard)/team/actions';
import { Alert, SubmitButton } from '@/components/auth/primitives';

const EMPTY: TeamActionState = {};

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none';
const label = 'mb-1.5 block text-[13px] font-semibold text-slate-700';
const small =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none';

export function InviteAdminForm() {
  const [state, submit] = useActionState(createAdminAction, EMPTY);

  return (
    <form action={submit} className="space-y-3 px-5 py-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Email</span>
          <input name="email" type="email" required autoComplete="off" className={input} />
        </label>
        <label className="block">
          <span className={label}>Name</span>
          <input name="name" autoComplete="off" className={input} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Role</span>
          <select name="role" defaultValue="admin" className={input}>
            <option value="viewer">Read-only — can look, cannot change</option>
            <option value="admin">Admin — can change customers, tools and prices</option>
            <option value="owner">Owner — can also manage console access</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Temporary password</span>
          <input
            name="password"
            type="text"
            autoComplete="off"
            placeholder="Leave empty for Google-only"
            className={`${input} font-mono text-xs`}
          />
        </label>
      </div>

      <SubmitButton>Add console account</SubmitButton>
      <p className="text-xs text-slate-400">
        There is no invitation email. Send the password to the person yourself and have them change
        it after their first sign-in — or leave it empty, and they sign in with Google instead.
      </p>
    </form>
  );
}

export function RoleForm({ adminId, role }: { adminId: string; role: string }) {
  const [state, submit] = useActionState(setAdminRoleAction, EMPTY);

  return (
    <form action={submit} className="flex items-center gap-1.5">
      <input type="hidden" name="admin_id" value={adminId} />
      <select name="role" defaultValue={role} className={small}>
        <option value="viewer">Read-only</option>
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </select>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-800"
      >
        Save
      </button>
      {state.error && <span className="text-[11px] font-semibold text-rose-600">{state.error}</span>}
      {state.notice && <span className="text-[11px] font-semibold text-emerald-600">Saved</span>}
    </form>
  );
}

export function DisableForm({ adminId, disabled }: { adminId: string; disabled: boolean }) {
  const [state, submit] = useActionState(setAdminDisabledAction, EMPTY);

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="admin_id" value={adminId} />
      <input type="hidden" name="disable" value={disabled ? 'false' : 'true'} />
      <button
        type="submit"
        className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
          disabled
            ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            : 'border-rose-200 text-rose-700 hover:bg-rose-50'
        }`}
      >
        {disabled ? 'Restore' : 'Disable'}
      </button>
      {state.error && <span className="text-[11px] font-semibold text-rose-600">{state.error}</span>}
    </form>
  );
}

export function ResetPasswordForm({ adminId }: { adminId: string }) {
  const [state, submit] = useActionState(resetAdminPasswordAction, EMPTY);

  return (
    <form action={submit} className="flex items-center gap-1.5">
      <input type="hidden" name="admin_id" value={adminId} />
      <input
        name="password"
        type="text"
        autoComplete="off"
        placeholder="New password"
        className={`${small} w-40 font-mono text-xs`}
      />
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Set
      </button>
      {state.error && <span className="text-[11px] font-semibold text-rose-600">{state.error}</span>}
      {state.notice && <span className="text-[11px] font-semibold text-emerald-600">Set</span>}
    </form>
  );
}

export function OwnPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, submit] = useActionState(changeOwnPasswordAction, EMPTY);

  return (
    <form action={submit} className="space-y-3 px-5 py-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      {hasPassword && (
        <label className="block">
          <span className={label}>Current password</span>
          <input
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className={input}
          />
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>New password</span>
          <input name="password" type="password" autoComplete="new-password" required className={input} />
        </label>
        <label className="block">
          <span className={label}>Repeat it</span>
          <input name="confirm" type="password" autoComplete="new-password" required className={input} />
        </label>
      </div>

      <SubmitButton variant="ghost">
        {hasPassword ? 'Change password' : 'Set a password'}
      </SubmitButton>
      <p className="text-xs text-slate-400">
        At least 12 characters, with a letter and a digit.
      </p>
    </form>
  );
}
