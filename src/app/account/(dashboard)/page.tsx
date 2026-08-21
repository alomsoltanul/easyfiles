import Link from 'next/link';
import { requireUser, getEntitlements } from '@/lib/auth';
import { getRecentRuns, getRunStats } from '@/lib/account-data';
import { getPlan, formatBytes } from '@/lib/plans';
import { humanBytes } from '@/lib/format';
import UsageBar from '@/components/account/UsageBar';
import RunList from '@/components/account/RunList';

export default async function AccountOverviewPage() {
  const { user } = await requireUser('/account');
  const [entitlements, stats, recent] = await Promise.all([
    getEntitlements(),
    getRunStats(user.id),
    getRecentRuns(user.id),
  ]);

  const plan = getPlan(entitlements.planId);
  const { limits, usageToday } = entitlements;
  const onFreePlan = plan.id === 'free';

  return (
    <div className="space-y-8">
      {/* Plan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your plan</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{plan.name}</p>
            <p className="mt-0.5 text-[13px] text-slate-500">{plan.tagline}</p>
          </div>

          <Link
            href={onFreePlan ? '/pricing' : '/account/billing'}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {onFreePlan ? 'Upgrade' : 'Manage plan'}
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <UsageBar label="Runs today" used={usageToday.total} limit={limits.runsPerDay} suffix="runs" />
          <UsageBar
            label="Video downloads today"
            used={usageToday.video}
            limit={limits.videoPerDay}
            suffix="downloads"
          />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
          {[
            { label: 'Max file size', value: formatBytes(limits.maxFileBytes) },
            { label: 'Files per batch', value: limits.maxBatch === null ? 'Unlimited' : String(limits.maxBatch) },
            {
              label: 'History kept',
              value:
                limits.historyDays === null
                  ? 'Forever'
                  : limits.historyDays === 0
                    ? 'Not kept'
                    : `${limits.historyDays} days`,
            },
            { label: 'Paid tools', value: limits.proTools ? 'All 56' : '44 free' },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] font-medium text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* This month */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Runs this month', value: String(stats.runsThisMonth) },
          { label: 'Data processed', value: humanBytes(stats.bytesThisMonth) },
          { label: 'Failed runs', value: String(stats.failures) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      {/* Most used */}
      {stats.topTools.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-800">Your most used tools this month</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topTools.map((tool) => (
              <Link
                key={tool.slug}
                href={tool.slug}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300"
              >
                {tool.label}
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">
                  {tool.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Recent activity</h2>
          <Link href="/account/history" className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700">
            View all
          </Link>
        </div>
        <RunList runs={recent} />
      </section>
    </div>
  );
}
