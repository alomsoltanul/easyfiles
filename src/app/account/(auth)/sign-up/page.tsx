import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignUpForm from '@/components/auth/SignUpForm';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Create your free account — ConvertTools',
  description:
    'A free ConvertTools account saves the tools you have used, raises your file size limit and unlocks your history.',
  robots: { index: false, follow: false },
};

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (await getUser()) redirect(next);

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Create your free account</h1>
      <p className="mt-1.5 mb-6 text-sm text-slate-500">
        Keep a history of every conversion, and get bigger file limits. Free, no card needed.
      </p>
      <SignUpForm next={next} />
    </>
  );
}
