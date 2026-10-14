'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(site)/account/(auth)/actions';

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile-link', label: 'My Link Page' },
  { href: '/account/history', label: 'Tool history' },
  { href: '/account/billing', label: 'Plan & billing' },
  { href: '/account/settings', label: 'Settings' },
];

export default function AccountNav() {
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
