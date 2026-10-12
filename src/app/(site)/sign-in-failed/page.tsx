import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign-in failed — ConvertTools',
  robots: { index: false, follow: false },
};

/**
 * Where a failed OAuth round trip lands.
 *
 * This page exists so that NextAuth's `pages.error` is a public address. If it
 * pointed at the console's login screen instead, anyone could send a single
 * unauthenticated request to /api/auth/callback/google and read the console's
 * secret path straight out of the redirect. It deliberately says nothing about
 * which sign-in failed.
 */
export default function SignInFailedPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        That sign-in didn&apos;t go through
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
        The attempt was refused or the link had expired. Go back to where you started and try
        again.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Back to the tools
      </Link>
    </div>
  );
}
