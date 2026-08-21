import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { adminHref } from '@/lib/admin-path';
import AccountNav from '@/components/account/AccountNav';

export const metadata: Metadata = {
  title: 'Your account — ConvertTools',
  robots: { index: false, follow: false },
};

/**
 * Everything under this group needs a session. requireUser() bounces to
 * sign-in with a ?next= back to wherever they were headed.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {profile.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Your account'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <AccountNav adminPath={profile.role === 'admin' ? adminHref() : null} />
        <div className="min-w-0">{children}</div>
      </div>

      <p className="mt-12 text-center text-xs text-slate-400">
        Files are still converted in your browser and never uploaded — we only keep a record of
        which tool you used and when.{' '}
        <Link href="/" className="font-semibold text-slate-500 hover:text-slate-700">
          Back to the tools
        </Link>
      </p>
    </div>
  );
}
