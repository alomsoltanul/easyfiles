import 'server-only';

import { getSupabaseAdminClient } from '../supabase/admin';
import { clientIp } from './rate-limit';
import type { AdminActor } from './session';

/**
 * Every mutation made from the console lands here.
 *
 * The log is written with the service role and has no delete path anywhere in
 * the app — not for an admin, not for an owner. `actor_id` is an admin_users
 * row; `actor_email` is copied in so the entry stays readable after the account
 * is renamed or disabled.
 */
export async function writeAdminAudit(
  actor: AdminActor,
  action: string,
  target: { type: string; id: string },
  meta: Record<string, unknown> = {},
): Promise<void> {
  const admin = getSupabaseAdminClient();

  await admin.from('admin_audit').insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target_type: target.type,
    target_id: target.id,
    meta: meta as never,
    ip: await clientIp(),
  });
}
