'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DEPARTMENTS,
  DEPARTMENT_LIST,
  ICONS,
  TOOL_COUNT,
  deptCount,
  groupedTools,
  searchTools,
  type DeptId,
} from '@/lib/tools';

interface ToolsDashboardProps {
  department: DeptId;
}

export default function ToolsDashboard({ department }: ToolsDashboardProps) {
  const meta = DEPARTMENTS[department];
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    if (!query.trim()) return groupedTools(department);
    const matches = searchTools(query, department);
    return groupedTools(department)
      .map((group) => ({ name: group.name, tools: group.tools.filter((t) => matches.includes(t)) }))
      .filter((group) => group.tools.length > 0);
  }, [query, department]);

  const matchCount = groups.reduce((sum, g) => sum + g.tools.length, 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(ellipse_50%_60%_at_90%_20%,rgba(99,102,241,0.16),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="hero-rise">
            <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All {TOOL_COUNT} tools
            </Link>

            <div className="flex items-start gap-4">
              <div className={`h-14 w-14 shrink-0 rounded-2xl bg-linear-to-br ${meta.gradient} p-3.5 text-white shadow-lg`}>
                {ICONS[meta.icon]}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{meta.name}</h1>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-400">{meta.description}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {[`${deptCount(department)} tools`, '100% in-browser', 'No uploads', 'Free forever'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-rise hero-rise-delay relative mt-8 max-w-md">
            <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${meta.short.toLowerCase()} tools…`}
              aria-label={`Search ${meta.name}`}
              className="w-full rounded-xl border border-white/15 bg-white/10 py-3.5 pl-12 pr-10 text-sm text-white placeholder:text-slate-500 backdrop-blur-sm transition-all focus:border-emerald-400/60 focus:bg-white/15 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sibling department strip */}
      <div className="sticky top-[68px] z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            All Tools
          </Link>
          {DEPARTMENT_LIST.map((d) => (
            <Link
              key={d.id}
              href={d.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                d.id === department ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${d.dot}`} />
              {d.short}
              <span className="opacity-60">{deptCount(d.id)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Grouped tools */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {matchCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center">
            <h3 className="font-semibold text-slate-700">No {meta.short} tool matches “{query}”</h3>
            <button onClick={() => setQuery('')} className="mt-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <section key={group.name}>
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">{group.name}</h2>
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-semibold text-slate-400">{group.tools.length}</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tools.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className={`h-10 w-10 shrink-0 rounded-xl p-2.5 ${meta.bg} ${meta.text}`}>{ICONS[tool.icon]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`truncate text-sm font-semibold text-slate-900 ${meta.hoverText} transition-colors`}>
                              {tool.label}
                            </h3>
                            {tool.badge && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-700">
                                {tool.badge}
                              </span>
                            )}
                            {tool.access === 'pro' && (
                              <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-violet-700">
                                Pro
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{tool.description}</p>
                        </div>
                        <svg className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
