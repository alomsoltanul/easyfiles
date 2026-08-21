import { ADMIN_PAGE_SIZE, listAudit } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { formatDateTime } from '@/lib/format';
import { Badge, Pager, Panel, TableScroll } from '@/components/admin/primitives';

const TONE: Record<string, 'rose' | 'amber' | 'emerald' | 'violet' | 'slate'> = {
  'user.ban': 'rose',
  'user.unban': 'emerald',
  'user.role.change': 'violet',
  'user.plan.grant': 'emerald',
  'user.plan.revoke': 'amber',
  'tool.flag.set': 'slate',
  'plan.update': 'amber',
};

export default async function ConsoleAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(parseInt(params.page ?? '1', 10) || 1, 1);
  const { entries, total } = await listAudit(page);

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[13px] leading-relaxed text-slate-500">
        Every change made from this console is recorded here. The log is written with the service
        role and has no delete path from the app — including for admins.
      </p>

      <Panel title={`${total} entr${total === 1 ? 'y' : 'ies'}`}>
        {entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">When</th>
                    <th className="px-3 py-2.5 font-bold">Who</th>
                    <th className="px-3 py-2.5 font-bold">Action</th>
                    <th className="px-3 py-2.5 font-bold">Target</th>
                    <th className="px-5 py-2.5 font-bold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-500">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">{entry.actor_email ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={TONE[entry.action] ?? 'slate'}>{entry.action}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] text-slate-500">
                          {entry.target_type}:{entry.target_id?.slice(0, 12)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="font-mono text-[11px] text-slate-400">
                          {JSON.stringify(entry.meta)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pager
              page={page}
              total={total}
              pageSize={ADMIN_PAGE_SIZE}
              hrefFor={(next) => (next > 1 ? `${ADMIN_PATH}/audit?page=${next}` : `${ADMIN_PATH}/audit`)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
