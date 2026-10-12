import type { Metadata } from 'next';
import Link from 'next/link';
import { getSellablePlans, getLivePlan } from '@/lib/plan-source';
import { getEntitlements } from '@/lib/auth';
import { FREE_TOOL_COUNT, PRO_TOOLS, TOOL_COUNT } from '@/lib/tools';
import { formatBytes } from '@/lib/plans';
import PricingTable, { type PricingPlan } from '@/components/pricing/PricingTable';

export const metadata: Metadata = {
  title: `Pricing — ${TOOL_COUNT} image, PDF, JSON and video tools`,
  description: `${FREE_TOOL_COUNT} tools are free with no account. Paid plans from $4/month unlock every tool, larger files and unlimited runs. Yearly billing saves two months.`,
  alternates: { canonical: '/pricing' },
};

const FAQ = [
  {
    q: 'Do I need an account to use the tools?',
    a: `No. ${FREE_TOOL_COUNT} of the ${TOOL_COUNT} tools work with no sign-up at all. An account raises your file size limit and keeps a history of what you have converted.`,
  },
  {
    q: 'Are my files uploaded to your servers?',
    a: 'The image, PDF and JSON tools run entirely in your browser — the file never leaves your device. The video downloader is the exception: it has to fetch the video server-side.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'You keep your plan until the end of the period you have already paid for, then drop back to the free tier. Your history stays for as long as the free tier allows.',
  },
  {
    q: 'Can I switch between monthly and yearly?',
    a: 'Yes, from the billing page. Stripe prorates the difference automatically.',
  },
];

export default async function PricingPage() {
  const [plans, entitlements, freePlan] = await Promise.all([
    getSellablePlans(),
    getEntitlements(),
    getLivePlan('free'),
  ]);

  const cards: PricingPlan[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    features: plan.features,
    highlight: plan.highlight,
    current: entitlements.planId === plan.id,
    // Without a Stripe price ID there is nothing to check out against, so the
    // button says so rather than failing after the click.
    purchasable: Boolean(plan.stripePriceIdMonth && plan.stripePriceIdYear),
  }));

  const freeFeatures = [
    `${FREE_TOOL_COUNT} tools, no account`,
    `${formatBytes(freePlan.limits.maxFileBytes)} files with a free account`,
    `${freePlan.limits.historyDays} days of history`,
    'No watermarks, no ads on tool pages',
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-emerald-600">Pricing</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Most of it is free. Pay when you need more.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500">
          {FREE_TOOL_COUNT} of our {TOOL_COUNT} tools cost nothing and need no account. A paid plan
          unlocks the {PRO_TOOLS.length} heavier tools, much larger files and unlimited runs.
        </p>
      </div>

      <div className="mt-12">
        <PricingTable plans={cards} signedIn={entitlements.signedIn} freeFeatures={freeFeatures} />
      </div>

      {/* What the paid plans unlock */}
      <section className="mt-16">
        <h2 className="text-center text-lg font-bold tracking-tight text-slate-900">
          The {PRO_TOOLS.length} tools every paid plan unlocks
        </h2>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {PRO_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              {tool.label}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-center text-lg font-bold tracking-tight text-slate-900">
          Questions people ask
        </h2>
        <dl className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {FAQ.map((item) => (
            <div key={item.q} className="px-5 py-4">
              <dt className="text-sm font-semibold text-slate-900">{item.q}</dt>
              <dd className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
