import Link from 'next/link';
import { getAdminOverview } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { formatPrice, getPlan } from '@/lib/plans';
import { Panel, Sparkbars, StatCard } from '@/components/admin/primitives';

export default async function ConsoleOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={String(overview.users)}
          hint={`+${overview.newUsers7d} in the last 7 days`}
        />
        <StatCard
          label="MRR"
          value={formatPrice(overview.mrrCents)}
          hint={`${overview.activeSubs} live subscription${overview.activeSubs === 1 ? '' : 's'}`}
        />
        <StatCard label="Runs today" value={String(overview.runsToday)} />
        <StatCard
          label="Runs, 30 days"
          value={String(overview.runs30d)}
          hint={`${overview.failures30d} failed`}
        />
      </div>

      <Panel
        title="Runs per day, last 30 days"
        action={
          <Link
            href={`${ADMIN_PATH}/usage`}
            className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Per tool
          </Link>
        }
      >
        <Sparkbars data={overview.series} />
      </Panel>

      <Panel
        title="Live subscriptions by plan"
        action={
          <Link
            href={`${ADMIN_PATH}/subs`}
            className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700"
          >
            All subscriptions
          </Link>
        }
      >
        {overview.planCounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No paid subscriptions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {overview.planCounts
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <li key={row.planId} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-semibold text-slate-800">
                    {getPlan(row.planId).name}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{row.count}</span>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
