'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DEPARTMENTS, ICONS, searchTools } from '@/lib/tools';

/**
 * Search box on the 404 page. A wrong URL is usually a mistyped tool name, so
 * the fastest recovery is letting them search the registry right here.
 */
export default function NotFoundSearch() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchTools(query).slice(0, 6) : []), [query]);

  return (
    <div className="mt-8 w-full max-w-lg">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all 56 tools…"
          aria-label="Search tools"
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {query.trim() && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No tool matches “{query}”
            </p>
          ) : (
            <ul className="p-1.5">
              {results.map((tool) => {
                const meta = DEPARTMENTS[tool.dept];
                return (
                  <li key={tool.href}>
                    <Link
                      href={tool.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50"
                    >
                      <span className={`h-7 w-7 shrink-0 rounded-lg p-1.5 ${meta.bg} ${meta.text}`}>
                        {ICONS[tool.icon]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{tool.label}</span>
                        <span className="block truncate text-xs text-slate-500">{tool.short}</span>
                      </span>
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
