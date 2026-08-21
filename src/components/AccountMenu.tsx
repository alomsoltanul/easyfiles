'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/app/account/(auth)/actions';
import { useMe } from '@/hooks/useEntitlements';

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

const MENU_LINKS = [
  { href: '/account', label: 'Dashboard' },
  { href: '/account/history', label: 'Tool history' },
  { href: '/account/billing', label: 'Plan & billing' },
  { href: '/account/settings', label: 'Settings' },
];

/**
 * Right-hand side of the header. Renders the signed-out buttons until /api/me
 * resolves, so the first paint never flashes a logged-in state at a visitor who
 * is not logged in.
 */
export default function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me?.signedIn || !me.user) {
    /* Signed out — or still loading, which looks the same on purpose. */
    if (compact) {
      return (
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Plans
          </Link>
          <Link
            href="/account/sign-in"
            className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Sign In
          </Link>
          <Link
            href="/account/sign-up"
            className="rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Sign Up
          </Link>
        </div>
      );
    }

    return (
      <>
        <Link
          href="/account/sign-in"
          className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 xl:inline-flex"
        >
          Sign In
        </Link>
        <Link
          href="/account/sign-up"
          className="hidden items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 sm:inline-flex"
        >
          Sign Up
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </>
    );
  }

  const { user, planName, planId } = me;

  if (compact) {
    return (
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {initials(user.fullName, user.email)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {user.fullName || user.email}
            </span>
            <span className="block text-xs text-slate-500">{planName} plan</span>
          </span>
        </div>
        {MENU_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            {link.label}
          </Link>
        ))}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-slate-500"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
          {initials(user.fullName, user.email)}
        </span>
        <svg
          className={`hidden h-3 w-3 text-slate-400 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.fullName || user.email}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  planId === 'free' ? 'bg-slate-300' : 'bg-emerald-500'
                }`}
              />
              {planName} plan
            </p>
          </div>

          <div className="p-1.5">
            {MENU_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}

            {user.isAdmin && me.adminPath && (
              <Link
                href={me.adminPath}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
              >
                Admin console
              </Link>
            )}
          </div>

          <div className="border-t border-slate-100 p-1.5">
            <form action={signOutAction}>
              <button
                type="submit"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
