import Link from 'next/link';

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Table wrapper that scrolls sideways instead of blowing out the page. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Pager({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  if (pageCount <= 1) return null;

  return (
    <nav className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-[13px] font-semibold text-slate-600 hover:text-slate-900">
          Previous
        </Link>
      ) : (
        <span className="text-[13px] font-semibold text-slate-300">Previous</span>
      )}
      <span className="text-[13px] font-medium text-slate-500">
        Page {page} of {pageCount} · {total} total
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="text-[13px] font-semibold text-slate-600 hover:text-slate-900">
          Next
        </Link>
      ) : (
        <span className="text-[13px] font-semibold text-slate-300">Next</span>
      )}
    </nav>
  );
}

/** Tiny inline bar chart — enough to see a trend without shipping a chart lib. */
export function Sparkbars({ data }: { data: { day: string; runs: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.runs));

  return (
    <div className="flex h-24 items-end gap-1 px-5 py-4">
      {data.map((point) => (
        <div
          key={point.day}
          title={`${point.day}: ${point.runs} runs`}
          className="flex-1 rounded-t bg-slate-200 transition-colors hover:bg-emerald-400"
          style={{ height: `${Math.max(2, (point.runs / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
