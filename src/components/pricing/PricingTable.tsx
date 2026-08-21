'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BillingInterval, PlanId } from '@/lib/plans';
import { formatPrice, monthlyEquivalent, yearlySavingsPercent } from '@/lib/plans';

export interface PricingPlan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlight?: boolean;
  /** true when this is the plan the visitor is already on */
  current?: boolean;
  purchasable: boolean;
}

export default function PricingTable({
  plans,
  signedIn,
  freeFeatures,
}: {
  plans: PricingPlan[];
  signedIn: boolean;
  freeFeatures: string[];
}) {
  const [interval, setInterval] = useState<BillingInterval>('year');
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const bestSaving = Math.max(0, ...plans.map((p) => yearlySavingsPercent(p)));

  const checkout = (planId: PlanId) => {
    setError(null);

    if (!signedIn) {
      // Sign in first, then land back here — checkout needs an account to
      // attach the subscription to.
      router.push(`/account/sign-up?next=${encodeURIComponent('/pricing')}`);
      return;
    }

    setPendingPlan(planId);
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, interval }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
        window.location.href = data.url;
      } catch (err) {
        setError((err as Error).message);
        setPendingPlan(null);
      }
    });
  };

  return (
    <div>
      {/* Interval toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                interval === value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {value === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
        {bestSaving > 0 && (
          <p className="text-[13px] font-semibold text-emerald-600">
            Yearly saves up to {bestSaving}% — two months free
          </p>
        )}
      </div>

      {error && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[13px] font-semibold text-rose-700">
          {error}
        </p>
      )}

      {/* Cards */}
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
          const saving = yearlySavingsPercent(plan);
          const busy = isPending && pendingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                plan.highlight ? 'border-slate-900 shadow-lg shadow-slate-200/60' : 'border-slate-200'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}

              <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {formatPrice(price)}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  /{interval === 'year' ? 'year' : 'month'}
                </span>
              </div>
              <p className="mt-1 h-4 text-xs font-medium text-emerald-600">
                {interval === 'year' && saving > 0
                  ? `${formatPrice(monthlyEquivalent(plan))}/mo billed yearly · save ${saving}%`
                  : ''}
              </p>

              <button
                type="button"
                onClick={() => checkout(plan.id)}
                disabled={plan.current || busy || !plan.purchasable}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                  plan.highlight
                    ? 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60'
                    : 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 disabled:opacity-60'
                }`}
              >
                {busy && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                  </svg>
                )}
                {plan.current
                  ? 'Your current plan'
                  : !plan.purchasable
                    ? 'Coming soon'
                    : signedIn
                      ? `Choose ${plan.name}`
                      : `Start with ${plan.name}`}
              </button>

              <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[13px] text-slate-600">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Free tier */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Free — no card, no account needed</h3>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-slate-500">
              Most of what we do stays free. An account just raises the limits and keeps a record of
              what you have converted.
            </p>
          </div>
          {!signedIn && (
            <Link
              href="/account/sign-up"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
            >
              Create a free account
            </Link>
          )}
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {freeFeatures.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-[13px] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
