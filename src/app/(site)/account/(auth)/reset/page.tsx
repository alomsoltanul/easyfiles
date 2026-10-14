import type { Metadata } from 'next';
import ResetForm from '@/components/auth/ResetForm';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Choose a new password — ConvertTools',
  robots: { index: false, follow: false },
};

/**
 * Reached from the reset email by way of /auth/callback (PKCE) or direct recovery token.
 * Renders ResetForm which supports both server-verified sessions and client-side hash tokens.
 */
export default async function ResetPage() {
  const user = await getUser();

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1.5 mb-6 text-sm text-slate-500">
        This replaces your old password everywhere you are signed in.
      </p>
      <ResetForm hasServerSession={Boolean(user)} />
    </>
  );
}
