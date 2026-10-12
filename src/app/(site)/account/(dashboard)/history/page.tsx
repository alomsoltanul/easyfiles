import Link from 'next/link';
import { requireUser, getEntitlements } from '@/lib/auth';
import { getHistory } from '@/lib/account-data';
import { DEPARTMENT_LIST } from '@/lib/tools';
import RunList from '@/components/account/RunList';

const PAGE_SIZE = 25;

function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; dept?: string; status?: string }>;
}) {
  const [{ user }, params, entitlements] = await Promise.all([
    requireUser('/account/history'),
    searchParams,
    getEntitlements(),
  ]);

  const dept = param(params.dept);
  const statusParam = param(params.status);
  const status = statusParam === 'success' || statusParam === 'error' ? statusParam : undefined;
  const page = Math.max(parseInt(param(params.page) ?? '1', 10) || 1, 1);

  const { runs, total } = await getHistory(user.id, { page, pageSize: PAGE_SIZE, dept, status });
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const buildHref = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { dept, status, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === 'page' && value === '1')) search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `/account/history?${qs}` : '/account/history';
  };

  const retention =
    entitlements.limits.historyDays === null
      ? 'Your history is kept for as long as your account is open.'
      : `Your plan keeps ${entitlements.limits.historyDays} days of history.`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            {total} run{total === 1 ? '' : 's'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{retention}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip href={buildHref({ dept: undefined, page: '1' })} active={!dept} label="All tools" />
        {DEPARTMENT_LIST.map((meta) => (
          <FilterChip
            key={meta.id}
            href={buildHref({ dept: meta.id, page: '1' })}
            active={dept === meta.id}
            label={meta.short}
          />
        ))}
        <span className="mx-1 w-px self-stretch bg-slate-200" aria-hidden />
        <FilterChip
          href={buildHref({ status: status === 'error' ? undefined : 'error', page: '1' })}
          active={status === 'error'}
          label="Failed only"
        />
      </div>

      <RunList runs={runs} />

      {pageCount > 1 && (
        <nav className="flex items-center justify-between border-t border-slate-100 pt-4">
          <PageLink href={buildHref({ page: String(page - 1) })} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="text-[13px] font-medium text-slate-500">
            Page {page} of {pageCount}
          </span>
          <PageLink href={buildHref({ page: String(page + 1) })} disabled={page >= pageCount}>
            Next
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-[13px] font-semibold text-slate-300">{children}</span>;
  }
  return (
    <Link href={href} className="text-[13px] font-semibold text-slate-600 hover:text-slate-900">
      {children}
    </Link>
  );
}
