'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DEPARTMENTS,
  DEPARTMENT_LIST,
  ICONS,
  POPULAR_TOOLS,
  TOOLS,
  TOOL_COUNT,
  deptCount,
  searchTools,
  type DeptId,
} from '@/lib/tools';

const STEPS = [
  {
    title: 'Drop your file',
    body: 'Pick a tool and drag files straight in. Nothing is uploaded — the file is read by your own browser.',
    icon: 'download' as const,
  },
  {
    title: 'Tune the settings',
    body: 'Quality, format, page range, passwords, watermarks. Every option renders a live preview before you commit.',
    icon: 'repair' as const,
  },
  {
    title: 'Download the result',
    body: 'Save one file or grab the whole batch as a ZIP. Close the tab and every trace is gone.',
    icon: 'check' as const,
  },
];

const PROMISES = [
  {
    title: 'Files never leave your device',
    body: 'Conversion runs in WebAssembly and Canvas inside your browser. No upload, no server copy, no retention window.',
    icon: 'shield' as const,
  },
  {
    title: 'No accounts, no limits',
    body: 'No signup wall, no daily quota, no watermark on the output. Open a tool and use it.',
    icon: 'spark' as const,
  },
  {
    title: 'Fast on big batches',
    body: 'Processing is local, so speed scales with your machine instead of a queue you are waiting in.',
    icon: 'bolt' as const,
  },
];

const FAQS = [
  {
    q: 'Are my files uploaded to a server?',
    a: 'No. Image, PDF and JSON tools run entirely in your browser using WebAssembly and Canvas. The only exception is the video downloader, which has to fetch the media from the source platform on your behalf — nothing is stored afterwards.',
  },
  {
    q: 'Is there a file size limit?',
    a: 'There is no artificial cap. The practical limit is your device memory, since the whole file is held in the browser tab. Very large PDFs are processed page by page to keep memory usage low.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. Every tool works immediately with no signup, and there is no daily quota or watermark on output.',
  },
  {
    q: 'Does it work offline?',
    a: 'After the page has loaded, the in-browser tools keep working without a connection because all processing is local.',
  },
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [activeDept, setActiveDept] = useState<DeptId | 'all'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const browserRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchTools(query, activeDept), [query, activeDept]);
  const heroMatches = useMemo(() => (query.trim() ? searchTools(query).length : 0), [query]);

  const runSearch = (value: string) => {
    setQuery(value);
    if (value.trim() && activeDept !== 'all') setActiveDept('all');
  };

  const jumpToBrowser = () => {
    browserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* ------------------------------------------------------------ */}
      {/* Hero                                                          */}
      {/* ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent_60%),radial-gradient(ellipse_50%_50%_at_100%_10%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(56,189,248,0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="hero-rise text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {TOOL_COUNT} tools · nothing uploaded, ever
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Every file tool you need.
              <span className="block bg-linear-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
                None of the uploads.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Convert images, reshape PDFs, wrangle JSON and pull down video — all of it running inside your own browser tab.
              No account, no queue, no file ever touching a server.
            </p>
          </div>

          {/* Search */}
          <div className="hero-rise hero-rise-delay mx-auto mt-9 max-w-2xl">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && jumpToBrowser()}
                placeholder={`Search ${TOOL_COUNT} tools — try “heic”, “merge”, “compress”, “yaml”…`}
                aria-label="Search all tools"
                className="w-full rounded-2xl border border-white/15 bg-white/10 py-4 pl-14 pr-32 text-[15px] text-white placeholder:text-slate-500 backdrop-blur-sm transition-all focus:border-emerald-400/60 focus:bg-white/15 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
              />
              <button
                onClick={jumpToBrowser}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                {query.trim() ? `${heroMatches} result${heroMatches === 1 ? '' : 's'}` : 'Browse all'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-slate-500">Popular:</span>
              {['HEIC to JPEG', 'Merge PDFs', 'Compress PDF', 'JSON Formatter', 'YouTube'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    runSearch(term);
                    jumpToBrowser();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <dl className="hero-rise hero-rise-delay mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {[
              { v: String(TOOL_COUNT), l: 'tools' },
              { v: '4', l: 'categories' },
              { v: '0', l: 'files uploaded' },
              { v: 'Free', l: 'forever' },
            ].map((s) => (
              <div key={s.l} className="bg-slate-950/60 px-4 py-5 text-center backdrop-blur-sm">
                <dt className="text-2xl font-bold text-white">{s.v}</dt>
                <dd className="mt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Categories                                                    */}
      {/* ------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Pick a workspace</h2>
            <p className="mt-1.5 text-sm text-slate-500">Four toolsets, {TOOL_COUNT} tools, one tab.</p>
          </div>
          <Link href="/pdf" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            Most used: PDF tools →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DEPARTMENT_LIST.map((meta) => {
            const top = TOOLS.filter((t) => t.dept === meta.id).slice(0, 4);
            return (
              <div
                key={meta.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${meta.gradient}`} />
                <div className={`mb-4 h-11 w-11 rounded-xl p-2.5 ${meta.bg} ${meta.text}`}>{ICONS[meta.icon]}</div>

                <h3 className="text-lg font-bold text-slate-900">{meta.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{meta.description}</p>

                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {top.map((tool) => (
                    <li key={tool.href}>
                      <Link
                        href={tool.href}
                        className="flex items-center gap-2 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {tool.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href={meta.href}
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${meta.text}`}
                >
                  All {deptCount(meta.id)} {meta.short} tools
                  <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Popular                                                       */}
      {/* ------------------------------------------------------------ */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Most used this week</h2>
          <p className="mt-1.5 text-sm text-slate-500">The tools people open first.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {POPULAR_TOOLS.map((tool) => {
              const meta = DEPARTMENTS[tool.dept];
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <span className={`h-9 w-9 shrink-0 rounded-lg p-2 ${meta.bg} ${meta.text}`}>{ICONS[tool.icon]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold text-slate-900 ${meta.hoverText}`}>{tool.label}</span>
                    <span className="block truncate text-xs text-slate-500">{tool.short}</span>
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Full tool browser                                             */}
      {/* ------------------------------------------------------------ */}
      <section ref={browserRef} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">All {TOOL_COUNT} tools</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {query.trim()
                ? `${results.length} match${results.length === 1 ? '' : 'es'} for “${query}”`
                : 'Filter by category or search above.'}
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools…"
              aria-label="Filter tools"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="no-scrollbar mb-7 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveDept('all')}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeDept === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            All <span className="ml-1 opacity-60">{TOOL_COUNT}</span>
          </button>
          {DEPARTMENT_LIST.map((meta) => (
            <button
              key={meta.id}
              onClick={() => setActiveDept(meta.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeDept === meta.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.short} <span className="opacity-60">{deptCount(meta.id)}</span>
            </button>
          ))}
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-700">No tool matches “{query}”</h3>
            <p className="mt-1 text-sm text-slate-500">Try a format name like “webp”, or an action like “merge”.</p>
            <button onClick={() => { setQuery(''); setActiveDept('all'); }} className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((tool) => {
              const meta = DEPARTMENTS[tool.dept];
              return (
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
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{tool.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.name}</span>
                    <span className="text-[11px] font-medium text-slate-400">{tool.group}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/* How it works                                                  */}
      {/* ------------------------------------------------------------ */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Three steps, zero uploads</h2>
            <p className="mt-1.5 text-sm text-slate-500">Same flow for every tool on the site.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <span className="absolute right-5 top-4 text-4xl font-bold text-slate-200">{i + 1}</span>
                <div className="mb-4 h-10 w-10 rounded-xl bg-emerald-50 p-2.5 text-emerald-600">{ICONS[step.icon]}</div>
                <h3 className="font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Promises                                                      */}
      {/* ------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {PROMISES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 h-10 w-10 rounded-xl bg-slate-900 p-2.5 text-emerald-400">{ICONS[item.icon]}</div>
              <h3 className="font-bold text-slate-900">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* FAQ                                                           */}
      {/* ------------------------------------------------------------ */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Common questions</h2>

          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={faq.q}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-900">{faq.q}</span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-45' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  {open && <p className="-mt-1 pb-5 text-sm leading-relaxed text-slate-500">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* CTA                                                           */}
      {/* ------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center sm:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(16,185,129,0.25),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Start with the tool you came for</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              No signup, no upload, no limit. {TOOL_COUNT} tools waiting in this tab.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  searchRef.current?.focus();
                  searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Search all tools
              </button>
              {DEPARTMENT_LIST.map((meta) => (
                <Link
                  key={meta.id}
                  href={meta.href}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                >
                  {meta.short}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
