'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DEPARTMENT_LIST,
  DEPARTMENTS,
  ICONS,
  TOOL_COUNT,
  Tool,
  deptCount,
  groupedTools,
  searchTools,
  type DeptId,
} from '@/lib/tools';

/* ------------------------------------------------------------------ */
/* Mega menu panel                                                     */
/* ------------------------------------------------------------------ */

function MegaPanel({ dept, onNavigate, pathname }: { dept: DeptId; onNavigate: () => void; pathname: string | null }) {
  const meta = DEPARTMENTS[dept];
  const groups = groupedTools(dept);
  const total = deptCount(dept);
  const compact = total > 20;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-7">
      <div className="grid grid-cols-12 gap-8">
        {/* Left rail — department summary */}
        <div className="col-span-12 lg:col-span-3">
          <div className={`rounded-2xl border border-slate-200 bg-linear-to-br ${meta.gradient} p-5 text-white shadow-sm`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 p-2.5 mb-4">{ICONS[meta.icon]}</div>
            <p className="text-base font-bold">{meta.name}</p>
            <p className="text-sm text-white/80 mt-1.5 leading-relaxed">{meta.description}</p>
            <Link
              href={meta.href}
              onClick={onNavigate}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              View all {total} tools
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Right — grouped tool columns */}
        <div className="col-span-12 lg:col-span-9">
          <div className={`grid gap-x-6 gap-y-6 ${compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-2'}`}>
            {groups.map((group) => (
              <div key={group.name}>
                <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.name}</p>
                <ul className="space-y-0.5">
                  {group.tools.map((tool) => {
                    const active = pathname === tool.href;
                    return (
                      <li key={tool.href}>
                        <Link
                          href={tool.href}
                          onClick={onNavigate}
                          className={`group flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${
                            active ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-lg p-1 ${meta.bg} ${meta.text}`}>
                            {ICONS[tool.icon]}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className={`truncate text-[13px] font-semibold text-slate-800 ${meta.hoverText}`}>
                                {tool.label}
                              </span>
                              {tool.badge === 'Popular' && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-700">
                                  Hot
                                </span>
                              )}
                            </span>
                            {!compact && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{tool.short}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header search                                                       */
/* ------------------------------------------------------------------ */

function HeaderSearch({ onNavigate }: { onNavigate: () => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (query.trim() ? searchTools(query).slice(0, 8) : []), [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = () => {
    setOpen(false);
    setQuery('');
    onNavigate();
  };

  return (
    <div className="relative hidden lg:block" ref={boxRef}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search tools"
        aria-label="Search tools"
        className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:w-60 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-400">
        /
      </kbd>

      {open && query.trim() && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No tool matches “{query}”</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {results.map((tool) => {
                const meta = DEPARTMENTS[tool.dept];
                return (
                  <li key={tool.href}>
                    <Link
                      href={tool.href}
                      onClick={go}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
                    >
                      <span className={`h-7 w-7 shrink-0 rounded-lg p-1.5 ${meta.bg} ${meta.text}`}>{ICONS[tool.icon]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{tool.label}</span>
                        <span className="block truncate text-xs text-slate-500">{tool.short}</span>
                      </span>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${meta.text}`}>{meta.short}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile drawer                                                       */
/* ------------------------------------------------------------------ */

function MobileNav({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string | null }) {
  const [expanded, setExpanded] = useState<DeptId | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const matches: Tool[] = query.trim() ? searchTools(query).slice(0, 20) : [];

  return (
    <div className="fixed inset-0 top-[68px] z-40 flex flex-col bg-white lg:hidden">
      <div className="border-b border-slate-200 p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all tools…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {query.trim() ? (
          <ul className="space-y-1">
            {matches.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No tool matches “{query}”</p>}
            {matches.map((tool) => {
              const meta = DEPARTMENTS[tool.dept];
              return (
                <li key={tool.href}>
                  <Link href={tool.href} onClick={onClose} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50">
                    <span className={`h-8 w-8 shrink-0 rounded-lg p-1.5 ${meta.bg} ${meta.text}`}>{ICONS[tool.icon]}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{tool.label}</span>
                      <span className="block truncate text-xs text-slate-500">{tool.short}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <Link
              href="/"
              onClick={onClose}
              className="mb-2 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white"
            >
              All {TOOL_COUNT} tools
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {DEPARTMENT_LIST.map((meta) => {
              const isOpen = expanded === meta.id;
              return (
                <div key={meta.id} className="border-b border-slate-100 last:border-0">
                  <button
                    onClick={() => setExpanded(isOpen ? null : meta.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 py-3.5 text-left"
                  >
                    <span className={`h-9 w-9 shrink-0 rounded-xl p-2 ${meta.bg} ${meta.text}`}>{ICONS[meta.icon]}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-900">{meta.name}</span>
                      <span className="block text-xs text-slate-500">{deptCount(meta.id)} tools · {meta.tagline}</span>
                    </span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="pb-4">
                      {groupedTools(meta.id).map((group) => (
                        <div key={group.name} className="mb-3">
                          <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.name}</p>
                          <ul>
                            {group.tools.map((tool) => (
                              <li key={tool.href}>
                                <Link
                                  href={tool.href}
                                  onClick={onClose}
                                  className={`block rounded-lg px-2 py-2 text-sm ${
                                    pathname === tool.href ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600'
                                  }`}
                                >
                                  {tool.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <Link
                        href={meta.href}
                        onClick={onClose}
                        className={`inline-block px-2 text-sm font-semibold ${meta.text}`}
                      >
                        View all {meta.short} tools →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-6 flex flex-col gap-2">
              <Link href="/pricing" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                Plans
              </Link>
              <button type="button" className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white">
                Sign Up
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export default function AppHeader() {
  const pathname = usePathname();
  const [openDept, setOpenDept] = useState<DeptId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDept(null);
  }, []);

  const openNow = (dept: DeptId) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDept(dept);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenDept(null), 140);
  };

  /* close on route change — adjusted during render, not in an effect */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenDept(null);
    setMobileOpen(false);
  }

  /* escape + outside click */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDept(null);
        setMobileOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenDept(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const isDeptActive = (dept: DeptId) => {
    if (!pathname) return false;
    const meta = DEPARTMENTS[dept];
    if (pathname === meta.href || pathname.startsWith(`${meta.href}/`)) return true;
    return TOOL_HREFS[dept].some((href) => pathname === href || pathname.startsWith(`${href}/`));
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md" onMouseLeave={scheduleClose}>
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30 transition-transform duration-200 group-hover:scale-105">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="hidden sm:block leading-tight">
            <span className="block text-[17px] font-bold tracking-tight text-slate-900">ConvertTools</span>
            <span className="block text-[11px] font-medium text-slate-400">{TOOL_COUNT} free browser tools</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          {DEPARTMENT_LIST.map((meta) => {
            const isOpen = openDept === meta.id;
            const active = isDeptActive(meta.id);
            return (
              <button
                key={meta.id}
                onMouseEnter={() => openNow(meta.id)}
                onClick={() => (isOpen ? close() : openNow(meta.id))}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isOpen || active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`h-4 w-4 ${meta.text}`}>{ICONS[meta.icon]}</span>
                {meta.short}
                <svg
                  className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            );
          })}

          <Link
            href="/"
            onMouseEnter={close}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              pathname === '/' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            All Tools
          </Link>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch onNavigate={close} />

          <Link
            href="/pricing"
            onMouseEnter={close}
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 xl:inline-flex"
          >
            Plans
          </Link>
          <button
            type="button"
            onMouseEnter={close}
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 xl:inline-flex"
          >
            Sign In
          </button>
          <button
            type="button"
            onMouseEnter={close}
            className="hidden items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 sm:inline-flex"
          >
            Sign Up
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mega panel */}
      {openDept && (
        <div
          className="absolute inset-x-0 top-full hidden border-t border-slate-200 bg-white shadow-xl shadow-slate-300/20 lg:block"
          onMouseEnter={() => openNow(openDept)}
        >
          <div className="max-h-[calc(100vh-68px)] overflow-y-auto">
            <MegaPanel dept={openDept} onNavigate={close} pathname={pathname} />
          </div>
        </div>
      )}

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} />
    </header>
  );
}

/* href index used for active-state matching, built once at module load */
const TOOL_HREFS: Record<DeptId, string[]> = {
  image: [],
  pdf: [],
  json: [],
  video: [],
};
for (const meta of DEPARTMENT_LIST) {
  TOOL_HREFS[meta.id] = groupedTools(meta.id).flatMap((g) => g.tools.map((t) => t.href));
}
