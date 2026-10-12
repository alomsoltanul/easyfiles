'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface ConsoleNavItem {
  path: string;
  label: string;
  group: string;
}

/**
 * `basePath` comes from the server: the console is reached through the secret
 * path in ADMIN_PATH_SECRET, which is a server-only variable, so every link has
 * to be built from a value handed down as a prop rather than read here.
 */
export default function ConsoleNav({
  basePath,
  items,
}: {
  basePath: string;
  items: ConsoleNavItem[];
}) {
  const pathname = usePathname() ?? '';

  const groups = items.reduce<Record<string, ConsoleNavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <nav className="flex gap-6 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible">
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group} className="shrink-0">
          <p className="mb-1.5 hidden px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 lg:block">
            {group}
          </p>
          <div className="flex gap-1 lg:flex-col lg:gap-0.5">
            {groupItems.map((item) => {
              const href = item.path ? `${basePath}/${item.path}` : basePath;
              const active = item.path
                ? pathname === href || pathname.startsWith(`${href}/`)
                : pathname === basePath;

              return (
                <Link
                  key={item.path || 'overview'}
                  href={href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
