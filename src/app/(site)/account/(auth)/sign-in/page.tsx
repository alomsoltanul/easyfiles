import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/auth/SignInForm';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in — ConvertTools',
  robots: { index: false, follow: false },
};

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string; message?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (await getUser()) redirect(next);

  let initialError: string | undefined;
  let initialNotice: string | undefined;

  if (params.error === 'link') {
    initialError =
      params.message ||
      'Your sign-in or password reset link has expired or was already used. Please request a new one below.';
  } else if (params.error === 'oauth') {
    initialError = 'Sign in with your provider could not be completed. Please try again.';
  } else if (params.error === 'unavailable') {
    initialError = 'Account services are temporarily unavailable. Please try again shortly.';
  } else if (params.message) {
    initialError = params.message;
  }

  if (params.reset === '1') {
    initialNotice = 'Your password has been successfully updated. You can now sign in with your new password.';
  }

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 mb-6 text-sm text-slate-500">
        Sign in to see your tool history and use your plan’s limits.
      </p>
      <SignInForm next={next} initialError={initialError} initialNotice={initialNotice} />
    </>
  );
}
