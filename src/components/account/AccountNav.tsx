'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/account/(auth)/actions';

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/history', label: 'Tool history' },
  { href: '/account/billing', label: 'Plan & billing' },
  { href: '/account/settings', label: 'Settings' },
];

/**
 * `adminPath` is passed in from the server layout because ADMIN_PATH_SECRET is
 * a server-only variable — the browser cannot derive this link itself.
 */
export default function AccountNav({ adminPath }: { adminPath: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      {adminPath && (
        <Link
          href={adminPath}
          className="shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 lg:mt-2 lg:border-t lg:border-slate-100 lg:pt-4"
        >
          Admin console
        </Link>
      )}

      <form action={signOutAction} className="mt-2 lg:mt-4">
        <button
          type="submit"
          className="w-full shrink-0 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
