import 'server-only';

import { redirect } from 'next/navigation';
import type { AdminRole, AdminUser } from '../supabase/database.types';
import { auth } from './auth';
import { ADMIN_LOGIN_PATH } from './path';
import { findAdminById, roleAtLeast } from './users';

/**
 * The console's authorisation gate.
 *
 * The JWT says who signed in; this says whether they may still do anything.
 * Every call re-reads the admin_users row, so disabling an account or lowering
 * a role takes effect on the next request instead of when the token expires.
 * Console traffic is a handful of requests, so the extra read costs nothing
 * worth optimising away.
 */

export type AdminActor = AdminUser;

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await auth();
  const adminId = session?.user?.adminId;
  if (!adminId) return null;

  const actor = await findAdminById(adminId);
  if (!actor || actor.disabled_at) return null;
  return actor;
}

/**
 * For every page behind the login. Sends anyone else to the login screen.
 *
 * A token whose row has been disabled or deleted is deliberately left in place
 * rather than cleared: this runs during a layout render, where writing a cookie
 * is not allowed, and a stale token is harmless — it authorises nothing, and
 * the login screen it lands on is happy to take a fresh sign-in over the top.
 */
export async function requireAdminActor(): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) redirect(ADMIN_LOGIN_PATH);
  return actor;
}

/**
 * For mutations. `viewer` can open every screen but change nothing; `owner` is
 * additionally the only role that can manage console access itself.
 *
 * Returns rather than throws so a Server Action can put the refusal in the form
 * it came from instead of blowing up into an error boundary.
 */
export type Authorization =
  | { ok: true; actor: AdminActor }
  | { ok: false; error: string };

export async function authorize(minimum: AdminRole): Promise<Authorization> {
  const actor = await requireAdminActor();
  if (!roleAtLeast(actor.role, minimum)) {
    return {
      ok: false,
      error:
        minimum === 'owner'
          ? 'Only an owner can change console access.'
          : 'Your account has read-only access.',
    };
  }
  return { ok: true, actor };
}

/** Same check without throwing — for hiding controls a role cannot use. */
export function canWrite(role: AdminRole): boolean {
  return roleAtLeast(role, 'admin');
}

export function canManageTeam(role: AdminRole): boolean {
  return roleAtLeast(role, 'owner');
}
