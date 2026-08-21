import Link from 'next/link';
import { DEPARTMENT_LIST, FREE_TOOL_COUNT, ICONS, TOOL_COUNT, deptCount, toolsByDept } from '@/lib/tools';

export default function GlobalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="text-[17px] font-bold tracking-tight text-slate-900">ConvertTools</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              {TOOL_COUNT} file tools that run inside your browser. {FREE_TOOL_COUNT} of them are
              free with no account, and nothing you convert is ever uploaded.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['No uploads', `${FREE_TOOL_COUNT} free tools`].map((chip) => (
                <span key={chip} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Tool columns */}
          {DEPARTMENT_LIST.map((meta) => (
            <div key={meta.id}>
              <div className="mb-4 flex items-center gap-2">
                <span className={`h-5 w-5 ${meta.text}`}>{ICONS[meta.icon]}</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">{meta.name}</h4>
              </div>
              <ul className="space-y-2">
                {toolsByDept(meta.id)
                  .slice(0, 8)
                  .map((tool) => (
                    <li key={tool.href}>
                      <Link href={tool.href} className="text-[13px] text-slate-500 transition-colors hover:text-slate-900">
                        {tool.label}
                      </Link>
                    </li>
                  ))}
                <li>
                  <Link href={meta.href} className={`text-[13px] font-semibold ${meta.text}`}>
                    All {deptCount(meta.id)} tools →
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-xs text-slate-400">© {year} ConvertTools · All processing happens in your browser.</p>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Plans
            </Link>
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              All tools
            </Link>
            <span className="text-xs text-slate-300">Free &amp; open source</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
