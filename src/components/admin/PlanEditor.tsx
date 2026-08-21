'use client';

import { useActionState } from 'react';
import { updatePlanAction, type AdminActionState } from '@/app/(admin)/console/actions';
import { Alert } from '@/components/auth/primitives';

const EMPTY: AdminActionState = {};

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none';
const label = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400';

/**
 * Prices are stored in cents but edited in whole currency units — nobody wants
 * to type 2900 for $29.
 */
export default function PlanEditor({
  planId,
  name,
  monthlyCents,
  yearlyCents,
  priceIdMonth,
  priceIdYear,
}: {
  planId: string;
  name: string;
  monthlyCents: number;
  yearlyCents: number;
  priceIdMonth: string | null;
  priceIdYear: string | null;
}) {
  const [state, submit] = useActionState(updatePlanAction, EMPTY);

  return (
    <form action={submit} className="border-t border-slate-100 px-5 py-4 first:border-t-0">
      <input type="hidden" name="plan_id" value={planId} />

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{name}</h3>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          Save
        </button>
      </div>

      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="notice">{state.notice}</Alert>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={label}>Monthly (cents)</span>
          <input name="monthly_price" type="number" min={0} defaultValue={monthlyCents} className={input} />
        </label>
        <label className="block">
          <span className={label}>Yearly (cents)</span>
          <input name="yearly_price" type="number" min={0} defaultValue={yearlyCents} className={input} />
        </label>
        <label className="block">
          <span className={label}>Stripe price — month</span>
          <input
            name="stripe_price_id_month"
            defaultValue={priceIdMonth ?? ''}
            placeholder="price_…"
            className={`${input} font-mono text-xs`}
          />
        </label>
        <label className="block">
          <span className={label}>Stripe price — year</span>
          <input
            name="stripe_price_id_year"
            defaultValue={priceIdYear ?? ''}
            placeholder="price_…"
            className={`${input} font-mono text-xs`}
          />
        </label>
      </div>
    </form>
  );
}
