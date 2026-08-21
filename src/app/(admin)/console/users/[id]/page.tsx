import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserDetail } from '@/lib/admin-data';
import { ADMIN_PATH } from '@/lib/admin-path';
import { getPlan } from '@/lib/plans';
import { formatDateTime, humanBytes, relativeTime } from '@/lib/format';
import { Badge, Panel } from '@/components/admin/primitives';
import { BanForm, GrantPlanForm, RoleForm } from '@/components/admin/UserControls';

export default async function ConsoleUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { profile, subscription, recentRuns, runCount } = detail;
  const plan = getPlan(subscription?.plan_id ?? 'free');

  return (
    <div className="space-y-5">
      <Link
        href={`${ADMIN_PATH}/users`}
        className="inline-block text-[13px] font-semibold text-slate-500 hover:text-slate-800"
      >
        ← All users
      </Link>

      <Panel title="Account">
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Email', value: profile.email },
            { label: 'Name', value: profile.full_name || '—' },
            { label: 'Joined', value: formatDateTime(profile.created_at) },
            { label: 'Runs recorded', value: String(runCount) },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] font-medium text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <Badge tone={plan.id === 'free' ? 'slate' : 'emerald'}>{plan.name}</Badge>
          {subscription?.comped && <Badge tone="amber">Comped</Badge>}
          {profile.role === 'admin' && <Badge tone="violet">Admin</Badge>}
          {profile.banned_at && <Badge tone="rose">Suspended</Badge>}
          {subscription && (
            <span className="text-xs text-slate-500">
              {subscription.status} · {subscription.interval}ly · renews{' '}
              {formatDateTime(subscription.current_period_end)}
            </span>
          )}
        </div>

        {profile.banned_at && profile.ban_reason && (
          <p className="border-t border-slate-100 px-5 py-3 text-[13px] text-rose-700">
            Suspended {relativeTime(profile.banned_at)} — {profile.ban_reason}
          </p>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Plan">
          <div className="px-5 py-4">
            <GrantPlanForm userId={profile.id} currentPlan={plan.id} />
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Access">
            <div className="px-5 py-4">
              <RoleForm userId={profile.id} role={profile.role} />
            </div>
          </Panel>
          <Panel title={profile.banned_at ? 'Restore' : 'Suspend'}>
            <div className="px-5 py-4">
              <BanForm userId={profile.id} banned={Boolean(profile.banned_at)} />
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Recent runs">
        {recentRuns.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No runs recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentRuns.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {run.label ?? run.tool_slug}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.file_count} file{run.file_count === 1 ? '' : 's'} ·{' '}
                    {humanBytes(run.input_bytes)}
                    {run.status === 'error' && ` · failed${run.error_code ? `: ${run.error_code}` : ''}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{relativeTime(run.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
