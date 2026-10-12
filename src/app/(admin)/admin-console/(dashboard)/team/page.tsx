import { notFound } from 'next/navigation';
import { formatDateTime, relativeTime } from '@/lib/format';
import { canManageTeam, requireAdminActor } from '@/lib/admin/session';
import { listAdminUsers } from '@/lib/admin/users';
import { GOOGLE_ENABLED } from '@/lib/admin/auth';
import { Badge, PageHeader, Panel, TableScroll } from '@/components/admin/primitives';
import {
  DisableForm,
  InviteAdminForm,
  OwnPasswordForm,
  ResetPasswordForm,
  RoleForm,
} from '@/components/admin/TeamControls';

const ROLE_TONE = { owner: 'violet', admin: 'emerald', viewer: 'slate' } as const;

/**
 * Console accounts — the only screen that grants or removes console access.
 *
 * Customers are not listed here and can never appear here: they live in
 * auth.users, these live in admin_users, and nothing joins the two.
 */
export default async function ConsoleTeamPage() {
  const actor = await requireAdminActor();
  // The nav hides this page for non-owners; this makes typing the URL do the
  // same thing as any other unrouted path.
  if (!canManageTeam(actor.role)) notFound();

  const admins = await listAdminUsers();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team & access"
        description="Who can open this console, and what they may do once inside. An owner can manage access; an admin can change customers, tools and prices; read-only can look at everything and change nothing."
      />

      <Panel title={`${admins.length} console account${admins.length === 1 ? '' : 's'}`}>
        <TableScroll>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-bold">Account</th>
                <th className="px-3 py-2.5 font-bold">Sign-in</th>
                <th className="px-3 py-2.5 font-bold">Last seen</th>
                <th className="px-3 py-2.5 font-bold">Role</th>
                <th className="px-5 py-2.5 font-bold">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <tr key={admin.id} className="align-top hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">
                      {admin.name || '—'}
                      {admin.id === actor.id && (
                        <span className="ml-1.5 text-[11px] font-bold text-slate-400">you</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                    {admin.disabled_at && (
                      <p className="mt-1">
                        <Badge tone="rose">Disabled {relativeTime(admin.disabled_at)}</Badge>
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {admin.password_hash && <Badge tone="slate">Password</Badge>}
                      {admin.google_sub && <Badge tone="emerald">Google</Badge>}
                      {!admin.password_hash && !admin.google_sub && (
                        <Badge tone="amber">Not set up</Badge>
                      )}
                    </div>
                    {admin.id !== actor.id && (
                      <div className="mt-2">
                        <ResetPasswordForm adminId={admin.id} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {admin.last_login_at ? formatDateTime(admin.last_login_at) : 'Never'}
                  </td>
                  <td className="px-3 py-3">
                    {admin.id === actor.id ? (
                      <Badge tone={ROLE_TONE[admin.role]}>{admin.role}</Badge>
                    ) : (
                      <RoleForm adminId={admin.id} role={admin.role} />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {admin.id === actor.id ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <DisableForm adminId={admin.id} disabled={Boolean(admin.disabled_at)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <Panel title="Add a console account">
        <InviteAdminForm />
      </Panel>

      <Panel title="Your password">
        <OwnPasswordForm hasPassword={Boolean(actor.password_hash)} />
      </Panel>

      {!GOOGLE_ENABLED && (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[13px] leading-relaxed text-slate-500">
          Google sign-in is switched off because AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set.
          Accounts created without a password cannot sign in until one of the two exists.
        </p>
      )}
    </div>
  );
}
