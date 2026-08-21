import Link from 'next/link';
import { requireUser, getEntitlements } from '@/lib/auth';
import { getLivePlan } from '@/lib/plan-source';
import { formatPrice } from '@/lib/plans';
import { formatDate } from '@/lib/format';
import BillingActions from '@/components/account/BillingActions';

const STATUS_COPY: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  active: { label: 'Active', tone: 'ok' },
  trialing: { label: 'Trial', tone: 'ok' },
  past_due: { label: 'Payment failed', tone: 'warn' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
  canceled: { label: 'Cancelled', tone: 'bad' },
  incomplete: { label: 'Incomplete', tone: 'warn' },
  incomplete_expired: { label: 'Expired', tone: 'bad' },
  paused: { label: 'Paused', tone: 'warn' },
};

const TONES = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [{ subscription }, entitlements, params] = await Promise.all([
    requireUser('/account/billing'),
    getEntitlements(),
    searchParams,
  ]);

  const plan = await getLivePlan(entitlements.planId);
  const status = subscription ? (STATUS_COPY[subscription.status] ?? STATUS_COPY.incomplete) : null;
  const price = subscription?.interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <div className="space-y-5">
      {params.checkout === 'success' && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
          You’re on {plan.name}. Everything is unlocked — the change is already live.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Current plan
            </p>
            <div className="mt-1 flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{plan.name}</h2>
              {status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${TONES[status.tone]}`}
                >
                  {status.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {subscription
                ? `${formatPrice(price)} per ${subscription.interval}`
                : 'Free — no card on file'}
            </p>
          </div>

          <BillingActions hasSubscription={Boolean(subscription?.stripe_customer_id)} />
        </div>

        {subscription && (
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium text-slate-400">
                {subscription.cancel_at_period_end ? 'Access ends' : 'Renews'}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDate(subscription.current_period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-400">Billing</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800 capitalize">
                {subscription.interval}ly
              </dd>
            </div>
            {subscription.comped && (
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Note</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  Complimentary plan
                </dd>
              </div>
            )}
          </dl>
        )}

        {subscription?.cancel_at_period_end && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
            Your plan is set to end on {formatDate(subscription.current_period_end)}. You keep
            everything until then — reopen the billing portal to undo it.
          </p>
        )}

        {subscription?.status === 'past_due' && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
            The last payment did not go through. Update your card in the billing portal to keep your
            plan.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-800">What your plan includes</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
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

        {entitlements.planId !== 'business' && (
          <Link
            href="/pricing"
            className="mt-5 inline-block text-[13px] font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Compare all plans
          </Link>
        )}
      </section>
    </div>
  );
}
