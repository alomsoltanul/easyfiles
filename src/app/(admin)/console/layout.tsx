import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { ADMIN_PATH } from '@/lib/admin-path';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: 'Console',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Admin console shell.
 *
 * Two independent gates protect this: proxy.ts only reaches these routes
 * through the secret path in ADMIN_PATH_SECRET, and requireAdmin() below
 * renders the same custom 404 for anyone whose profile is not role='admin'.
 * The secret path is obscurity; this check is the actual authorisation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={ADMIN_PATH} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 8.5-7 9.9C8 20.5 5 16.5 5 12V7l7-4z" />
              </svg>
            </span>
            <span className="text-sm font-bold tracking-tight text-white">ConvertTools Console</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-medium text-slate-400 sm:block">{profile.email}</span>
            <Link href="/" className="text-xs font-semibold text-slate-300 hover:text-white">
              Back to site
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
          <AdminNav basePath={ADMIN_PATH} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
