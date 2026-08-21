import Link from 'next/link';
import { ADMIN_PAGE_SIZE, listSubscriptions } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { getPlan } from '@/lib/plans';
import { formatDate } from '@/lib/format';
import { Badge, Pager, Panel, TableScroll } from '@/components/admin/primitives';

const STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid'] as const;

const TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'slate'> = {
  active: 'emerald',
  trialing: 'emerald',
  past_due: 'amber',
  unpaid: 'rose',
  canceled: 'slate',
};

export default async function ConsoleSubsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && params.status.length > 0 ? params.status : undefined;
  const page = Math.max(parseInt(params.page ?? '1', 10) || 1, 1);

  const { subs, total } = await listSubscriptions({ status, page });

  const hrefFor = (nextPage: number) => {
    const search = new URLSearchParams();
    if (status) search.set('status', status);
    if (nextPage > 1) search.set('page', String(nextPage));
    const qs = search.toString();
    return qs ? `${ADMIN_PATH}/subs?${qs}` : `${ADMIN_PATH}/subs`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`${ADMIN_PATH}/subs`}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
            !status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          All
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`${ADMIN_PATH}/subs?status=${value}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize ${
              status === value
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {value.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <Panel title={`${total} subscription${total === 1 ? '' : 's'}`}>
        {subs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing here.</p>
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">Customer</th>
                    <th className="px-3 py-2.5 font-bold">Plan</th>
                    <th className="px-3 py-2.5 font-bold">Status</th>
                    <th className="px-3 py-2.5 font-bold">Period end</th>
                    <th className="px-5 py-2.5 font-bold">Stripe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`${ADMIN_PATH}/users/${sub.user_id}`}
                          className="font-semibold text-slate-900 hover:text-emerald-600"
                        >
                          {sub.email ?? sub.user_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-700">{getPlan(sub.plan_id).name}</span>
                        <span className="ml-1.5 text-xs text-slate-400">{sub.interval}ly</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={TONE[sub.status] ?? 'slate'}>{sub.status.replace('_', ' ')}</Badge>
                        {sub.comped && (
                          <span className="ml-1.5">
                            <Badge tone="amber">Comped</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {formatDate(sub.current_period_end)}
                        {sub.cancel_at_period_end && (
                          <span className="ml-1 font-semibold text-amber-600">· ending</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-[11px] text-slate-400">
                          {sub.stripe_subscription_id ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pager page={page} total={total} pageSize={ADMIN_PAGE_SIZE} hrefFor={hrefFor} />
          </>
        )}
      </Panel>
    </div>
  );
}
