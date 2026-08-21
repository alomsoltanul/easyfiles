import Link from 'next/link';
import type { Metadata } from 'next';
import NotFoundSearch from '@/components/NotFoundSearch';
import { DEPARTMENT_LIST, ICONS, POPULAR_TOOLS, TOOL_COUNT, deptCount } from '@/lib/tools';

export const metadata: Metadata = {
  title: 'Page not found — ConvertTools',
  robots: { index: false, follow: true },
};

/**
 * Served for every unrouted path, and for the paths proxy.ts deliberately
 * rewrites here (guessable admin/login URLs, direct hits on /console).
 * It must look like an ordinary miss in all of those cases — no hint that some
 * of them were blocked on purpose.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
      <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-emerald-600">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        That page isn’t here
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500">
        The link may be out of date, or the address slightly off. All {TOOL_COUNT} tools are still
        one search away.
      </p>

      <NotFoundSearch />

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEPARTMENT_LIST.map((meta) => (
          <Link
            key={meta.id}
            href={meta.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <span className={`inline-block h-9 w-9 rounded-xl p-2 ${meta.bg} ${meta.text}`}>
              {ICONS[meta.icon]}
            </span>
            <span className={`mt-3 block text-sm font-bold text-slate-900 ${meta.hoverText}`}>
              {meta.name}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {deptCount(meta.id)} tools · {meta.tagline}
            </span>
          </Link>
        ))}
      </div>

      {POPULAR_TOOLS.length > 0 && (
        <div className="mt-10 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Most used
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {POPULAR_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                {tool.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Back to all tools
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
