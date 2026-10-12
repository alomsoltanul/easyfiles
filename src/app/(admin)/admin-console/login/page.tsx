import { redirect } from 'next/navigation';
import { GOOGLE_ENABLED } from '@/lib/admin/auth';
import { ADMIN_PATH } from '@/lib/admin/path';
import { getAdminActor } from '@/lib/admin/session';
import AdminLoginForm from '@/components/admin/LoginForm';

/** Never cached: the whole point is to reflect the current session. */
export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  AccessDenied: 'That account has no console access.',
  Configuration: 'Sign-in is misconfigured. Check the server logs.',
  Verification: 'That link has expired.',
};

/**
 * The console's front door.
 *
 * NextAuth points both `pages.signIn` and `pages.error` here, so an OAuth
 * failure comes back as ?error= rather than to a generic Auth.js screen.
 */
export default async function ConsoleLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const actor = await getAdminActor();
  if (actor) redirect(ADMIN_PATH);

  const params = await searchParams;
  const key = params.code ?? params.error;

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-950 px-4 py-16">
      <AdminLoginForm
        googleEnabled={GOOGLE_ENABLED}
        initialError={key ? (MESSAGES[key] ?? 'Could not sign you in.') : undefined}
      />
    </div>
  );
}
