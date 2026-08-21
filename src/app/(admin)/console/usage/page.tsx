import Link from 'next/link';
import { getToolUsage } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { humanBytes } from '@/lib/format';
import { Panel, TableScroll } from '@/components/admin/primitives';

const RANGES = [7, 30, 90];

export default async function ConsoleUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;

  const rows = await getToolUsage(days);
  const totalRuns = rows.reduce((sum, r) => sum + r.runs, 0);
  const max = Math.max(1, ...rows.map((r) => r.runs));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((value) => (
          <Link
            key={value}
            href={`${ADMIN_PATH}/usage?days=${value}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              days === value
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {value} days
          </Link>
        ))}
      </div>

      <Panel title={`${totalRuns} runs across ${rows.length} tools`}>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No runs recorded in this window. Only signed-in users produce history.
          </p>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-bold">Tool</th>
                  <th className="px-3 py-2.5 font-bold">Runs</th>
                  <th className="px-3 py-2.5 font-bold">Failures</th>
                  <th className="px-3 py-2.5 font-bold">Data in</th>
                  <th className="px-5 py-2.5 font-bold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const failRate = row.runs > 0 ? Math.round((row.failures / row.runs) * 100) : 0;
                  return (
                    <tr key={row.slug} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link href={row.slug} className="font-semibold text-slate-900 hover:text-emerald-600">
                          {row.label}
                        </Link>
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-400">
                          {row.dept}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{row.runs}</td>
                      <td className="px-3 py-2.5">
                        <span className={failRate > 10 ? 'font-semibold text-rose-600' : 'text-slate-500'}>
                          {row.failures}
                          {row.failures > 0 && ` (${failRate}%)`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{humanBytes(row.bytes)}</td>
                      <td className="px-5 py-2.5">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${(row.runs / max) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}
