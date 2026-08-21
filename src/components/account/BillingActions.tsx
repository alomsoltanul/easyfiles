'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Everything about changing a paid plan happens in Stripe's billing portal —
 * card, plan switch, invoices, cancellation. One button, one source of truth.
 */
export default function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const openPortal = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/portal', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Could not open the billing portal.');
        window.location.href = data.url;
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {hasSubscription ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
              </svg>
            )}
            Manage billing
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/pricing')}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            See the plans
          </button>
        )}
      </div>

      {hasSubscription && (
        <p className="text-xs text-slate-400">
          Change plan, swap card, download invoices or cancel — all in Stripe’s portal.
        </p>
      )}
    </div>
  );
}
