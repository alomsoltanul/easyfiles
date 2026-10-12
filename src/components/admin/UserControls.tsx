'use client';

import { useActionState } from 'react';
import {
  grantPlanAction,
  revokeLegacyRoleAction,
  setUserBanAction,
  type AdminActionState,
} from '@/app/(admin)/admin-console/(dashboard)/actions';
import { PAID_PLAN_IDS, PLANS } from '@/lib/plans';
import { Alert, SubmitButton } from '@/components/auth/primitives';

const EMPTY: AdminActionState = {};

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none';
const label = 'mb-1.5 block text-[13px] font-semibold text-slate-700';

export function GrantPlanForm({ userId, currentPlan }: { userId: string; currentPlan: string }) {
  const [state, submit] = useActionState(grantPlanAction, EMPTY);

  return (
    <form action={submit} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}
      <input type="hidden" name="user_id" value={userId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Plan</span>
          <select name="plan_id" defaultValue={currentPlan} className={input}>
            <option value="free">Free (remove comp)</option>
            {PAID_PLAN_IDS.map((id) => (
              <option key={id} value={id}>
                {PLANS[id].name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={label}>Months</span>
          <input name="months" type="number" min={1} max={60} defaultValue={12} className={input} />
        </label>
      </div>

      <label className="block">
        <span className={label}>Note</span>
        <input name="note" placeholder="Why — shows in the audit log" className={input} />
      </label>

      <SubmitButton>Grant complimentary plan</SubmitButton>
      <p className="text-xs text-slate-400">
        Comped plans have no Stripe subscription behind them, so nothing is charged and nothing has
        to be cancelled.
      </p>
    </form>
  );
}

/**
 * Clears the pre-console role='admin' flag. Console access itself is not
 * granted here any more — it lives in admin_users, under Team &amp; access.
 */
export function LegacyRoleForm({ userId }: { userId: string }) {
  const [state, submit] = useActionState(revokeLegacyRoleAction, EMPTY);

  return (
    <form action={submit} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton variant="ghost">Remove elevated database access</SubmitButton>
      <p className="text-xs text-slate-400">
        This account was an admin before the console had its own logins. The flag no longer opens
        the console, but it still lets this customer&apos;s own session read other customers&apos;
        rows.
      </p>
    </form>
  );
}

export function BanForm({ userId, banned }: { userId: string; banned: boolean }) {
  const [state, submit] = useActionState(setUserBanAction, EMPTY);

  return (
    <form action={submit} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="banned" value={banned ? 'false' : 'true'} />

      {!banned && (
        <label className="block">
          <span className={label}>Reason</span>
          <input name="reason" placeholder="Shown in the audit log" className={input} />
        </label>
      )}

      <SubmitButton variant="ghost">{banned ? 'Restore account' : 'Suspend account'}</SubmitButton>
      <p className="text-xs text-slate-400">
        A suspended account keeps its data but drops to anonymous limits and cannot start a
        subscription.
      </p>
    </form>
  );
}
