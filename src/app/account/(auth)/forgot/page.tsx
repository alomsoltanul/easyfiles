import type { Metadata } from 'next';
import ForgotForm from '@/components/auth/ForgotForm';

export const metadata: Metadata = {
  title: 'Reset your password — ConvertTools',
  robots: { index: false, follow: false },
};

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1.5 mb-6 text-sm text-slate-500">
        Enter the address you signed up with and we’ll send a link to set a new password.
      </p>
      <ForgotForm />
    </>
  );
}
