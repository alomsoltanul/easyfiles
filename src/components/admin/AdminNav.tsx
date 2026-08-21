'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { path: '', label: 'Overview' },
  { path: 'users', label: 'Users' },
  { path: 'subs', label: 'Subscriptions' },
  { path: 'tools', label: 'Tools' },
  { path: 'plans', label: 'Plans' },
  { path: 'usage', label: 'Usage' },
  { path: 'audit', label: 'Audit log' },
];

/**
 * `basePath` comes from the server because the console is reached through the
 * secret path, not through /console — every link has to be built from it.
 */
export default function AdminNav({ basePath }: { basePath: string }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {ITEMS.map((item) => {
        const href = item.path ? `${basePath}/${item.path}` : basePath;
        const active = item.path
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === basePath;

        return (
          <Link
            key={item.path || 'overview'}
            href={href}
            className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
