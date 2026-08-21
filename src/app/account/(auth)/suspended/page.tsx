import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account suspended — ConvertTools',
  robots: { index: false, follow: false },
};

export default function SuspendedPage() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">This account is suspended</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        Sign-in is blocked while the account is under review. If you think this is a mistake, reply
        to any email from us and we’ll take another look.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Back to the free tools
      </Link>
    </>
  );
}
