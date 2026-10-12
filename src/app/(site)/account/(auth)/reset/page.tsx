import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ResetForm from '@/components/auth/ResetForm';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Choose a new password — ConvertTools',
  robots: { index: false, follow: false },
};

/**
 * Reached from the reset email by way of /auth/callback, which exchanges the
 * code for a session first — so a visitor here is already authenticated and
 * only needs to set the new password.
 */
export default async function ResetPage() {
  if (!(await getUser())) redirect('/account/forgot');

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1.5 mb-6 text-sm text-slate-500">
        This replaces your old password everywhere you are signed in.
      </p>
      <ResetForm />
    </>
  );
}
