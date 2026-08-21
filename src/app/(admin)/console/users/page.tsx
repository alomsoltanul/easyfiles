import Link from 'next/link';
import { ADMIN_PAGE_SIZE, listUsers } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { getPlan, PLAN_LIST } from '@/lib/plans';
import { formatDate } from '@/lib/format';
import { Badge, Pager, Panel, TableScroll } from '@/components/admin/primitives';

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

export default async function ConsoleUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const plan = one(params.plan);
  const role = one(params.role);
  const page = Math.max(parseInt(one(params.page) ?? '1', 10) || 1, 1);

  const { users, total } = await listUsers({ q, plan, role, page });

  const hrefFor = (nextPage: number) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (plan) search.set('plan', plan);
    if (role) search.set('role', role);
    if (nextPage > 1) search.set('page', String(nextPage));
    const qs = search.toString();
    return qs ? `${ADMIN_PATH}/users?${qs}` : `${ADMIN_PATH}/users`;
  };

  return (
    <div className="space-y-4">
      <form action={`${ADMIN_PATH}/users`} className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search email or name"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <select
          name="plan"
          defaultValue={plan ?? ''}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
        >
          <option value="">All plans</option>
          {PLAN_LIST.filter((p) => p.id !== 'anon').map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={role ?? ''}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="admin">Admins only</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Search
        </button>
      </form>

      <Panel title={`${total} user${total === 1 ? '' : 's'}`}>
        {users.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No users match that.</p>
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">User</th>
                    <th className="px-3 py-2.5 font-bold">Plan</th>
                    <th className="px-3 py-2.5 font-bold">Role</th>
                    <th className="px-3 py-2.5 font-bold">Joined</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{user.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={user.plan_id === 'free' ? 'slate' : 'emerald'}>
                          {getPlan(user.plan_id).name}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {user.role === 'admin' ? (
                          <Badge tone="violet">Admin</Badge>
                        ) : user.banned_at ? (
                          <Badge tone="rose">Suspended</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">User</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`${ADMIN_PATH}/users/${user.id}`}
                          className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Open
                        </Link>
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
