import Link from 'next/link';
import { DEPARTMENTS, ICONS, toolByHref } from '@/lib/tools';
import { humanBytes, relativeTime } from '@/lib/format';
import type { ToolRun } from '@/lib/supabase/database.types';
import type { DeptId } from '@/lib/tools';

function deptMeta(dept: string) {
  return DEPARTMENTS[dept as DeptId] ?? DEPARTMENTS.pdf;
}

/**
 * Shared history renderer. Each row links back to the tool, which is the whole
 * point of keeping history — pick up where you left off.
 */
export default function RunList({ runs }: { runs: ToolRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Nothing here yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">
          Every tool you run while signed in shows up here, so you can find it again later.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Browse the tools
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {runs.map((run) => {
        const meta = deptMeta(run.dept);
        const tool = toolByHref(run.tool_slug);
        const failed = run.status === 'error';

        return (
          <li key={run.id}>
            <Link href={run.tool_slug} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50">
              <span className={`h-9 w-9 shrink-0 rounded-xl p-2 ${meta.bg} ${meta.text}`}>
                {ICONS[tool?.icon ?? meta.icon]}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {run.label ?? tool?.label ?? run.tool_slug}
                  </span>
                  {failed && (
                    <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-rose-700">
                      Failed
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {run.file_count} file{run.file_count === 1 ? '' : 's'}
                  {run.input_bytes > 0 && ` · ${humanBytes(run.input_bytes)}`}
                  {failed && run.error_code && ` · ${run.error_code}`}
                </span>
              </span>

              <span className="shrink-0 text-xs font-medium text-slate-400">
                {relativeTime(run.created_at)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
