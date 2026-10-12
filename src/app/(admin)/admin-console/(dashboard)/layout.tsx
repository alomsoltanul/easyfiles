import { ADMIN_PATH } from '@/lib/admin/path';
import { canManageTeam, requireAdminActor } from '@/lib/admin/session';
import ConsoleNav, { type ConsoleNavItem } from '@/components/admin/ConsoleNav';
import { adminSignOutAction } from './actions';

const BASE_ITEMS: ConsoleNavItem[] = [
  { path: '', label: 'Overview', group: 'Business' },
  { path: 'users', label: 'Customers', group: 'Business' },
  { path: 'subs', label: 'Subscriptions', group: 'Business' },
  { path: 'plans', label: 'Plans & pricing', group: 'Business' },
  { path: 'tools', label: 'Tools', group: 'Product' },
  { path: 'usage', label: 'Usage', group: 'Product' },
  { path: 'audit', label: 'Audit log', group: 'Console' },
];

const TEAM_ITEM: ConsoleNavItem = { path: 'team', label: 'Team & access', group: 'Console' };

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', viewer: 'Read-only' } as const;

/**
 * Everything below this layout requires a console session.
 *
 * Two independent gates protect it: proxy.ts only reaches these routes through
 * the secret path in ADMIN_PATH_SECRET, and requireAdminActor() below re-reads
 * the admin_users row on every request. The secret path is obscurity; the row
 * read is the actual authorisation, and it is what makes disabling an account
 * take effect on the next click.
 */
export default async function ConsoleDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireAdminActor();
  const items = canManageTeam(actor.role) ? [...BASE_ITEMS, TEAM_ITEM] : BASE_ITEMS;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col gap-6 border-b border-slate-800 bg-slate-950 px-4 py-5 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 8.5-7 9.9C8 20.5 5 16.5 5 12V7l7-4z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Console</p>
            <p className="text-[11px] text-slate-500">ConvertTools</p>
          </div>
        </div>

        <ConsoleNav basePath={ADMIN_PATH} items={items} />

        <div className="mt-auto hidden border-t border-slate-800 pt-4 lg:block">
          <p className="truncate text-[13px] font-semibold text-slate-300">
            {actor.name || actor.email}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{ROLE_LABEL[actor.role]}</p>
          <form action={adminSignOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-slate-100">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="truncate text-[13px] font-semibold text-slate-700">{actor.email}</span>
          <form action={adminSignOutAction}>
            <button type="submit" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</div>
      </div>
    </div>
  );
}
