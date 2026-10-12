'use server';

import { revalidatePath } from 'next/cache';
import { writeAdminAudit } from '@/lib/admin/audit';
import { ADMIN_ROUTE_ROOT } from '@/lib/admin/path';
import { authorize, requireAdminActor } from '@/lib/admin/session';
import {
  countActiveOwners,
  createAdminUser,
  findAdminById,
  isAdminRole,
  setAdminDisabled,
  setAdminPassword,
  setAdminRole,
  verifyPassword,
} from '@/lib/admin/users';

export interface TeamActionState {
  error?: string;
  notice?: string;
}

function revalidateConsole() {
  revalidatePath(ADMIN_ROUTE_ROOT, 'layout');
}

/**
 * Console access is managed here and nowhere else. Only an owner may change it,
 * and the rules below exist to stop the console being locked out of itself:
 * nobody may demote or disable their own account, and the last owner who can
 * still sign in cannot be removed.
 */
export async function createAdminAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const gate = await authorize('owner');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const role = String(formData.get('role') ?? 'admin');
  if (!isAdminRole(role)) return { error: 'Unknown role.' };

  const { user, error } = await createAdminUser({
    email: String(formData.get('email') ?? ''),
    name: String(formData.get('name') ?? ''),
    role,
    password: String(formData.get('password') ?? ''),
    createdBy: actor.id,
  });

  if (error || !user) return { error: error ?? 'Could not create that account.' };

  await writeAdminAudit(actor, 'admin.create', { type: 'admin', id: user.id }, {
    email: user.email,
    role,
    // Recorded so it is obvious later whether the account can use a password at
    // all, without ever putting the password itself in the log.
    hasPassword: Boolean(user.password_hash),
  });
  revalidateConsole();

  return {
    notice: user.password_hash
      ? `${user.email} can now sign in.`
      : `${user.email} added — they must sign in with Google.`,
  };
}

export async function setAdminRoleAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const gate = await authorize('owner');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const id = String(formData.get('admin_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!isAdminRole(role)) return { error: 'Unknown role.' };

  if (id === actor.id) {
    return { error: 'You cannot change your own role. Ask another owner.' };
  }

  const target = await findAdminById(id);
  if (!target) return { error: 'No such account.' };

  if (target.role === 'owner' && role !== 'owner' && (await countActiveOwners()) <= 1) {
    return { error: 'That is the last owner. Promote someone else first.' };
  }

  const error = await setAdminRole(id, role);
  if (error) return { error };

  await writeAdminAudit(actor, 'admin.role.change', { type: 'admin', id }, {
    email: target.email,
    from: target.role,
    to: role,
  });
  revalidateConsole();
  return { notice: `${target.email} is now ${role}.` };
}

export async function setAdminDisabledAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const gate = await authorize('owner');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const id = String(formData.get('admin_id') ?? '');
  const disable = String(formData.get('disable') ?? '') === 'true';

  if (id === actor.id) return { error: 'You cannot disable your own account.' };

  const target = await findAdminById(id);
  if (!target) return { error: 'No such account.' };

  if (disable && target.role === 'owner' && (await countActiveOwners()) <= 1) {
    return { error: 'That is the last owner. Promote someone else first.' };
  }

  const error = await setAdminDisabled(id, disable);
  if (error) return { error };

  await writeAdminAudit(actor, disable ? 'admin.disable' : 'admin.enable', { type: 'admin', id }, {
    email: target.email,
  });
  revalidateConsole();
  return { notice: disable ? `${target.email} can no longer sign in.` : `${target.email} restored.` };
}

/** An owner resetting somebody else's password — the console has no email reset. */
export async function resetAdminPasswordAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const gate = await authorize('owner');
  if (!gate.ok) return { error: gate.error };
  const actor = gate.actor;

  const id = String(formData.get('admin_id') ?? '');
  const password = String(formData.get('password') ?? '');

  const target = await findAdminById(id);
  if (!target) return { error: 'No such account.' };

  const error = await setAdminPassword(id, password);
  if (error) return { error };

  await writeAdminAudit(actor, 'admin.password.set', { type: 'admin', id }, {
    email: target.email,
    self: false,
  });
  revalidateConsole();
  return { notice: `New password set for ${target.email}. Send it to them out of band.` };
}

/** Changing your own password. Available to every role, including viewers. */
export async function changeOwnPasswordAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const actor = await requireAdminActor();

  const current = String(formData.get('current_password') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (next !== confirm) return { error: 'The two new passwords do not match.' };

  // An account created for Google sign-in has no password to prove yet; anyone
  // holding that session is already authenticated, so setting a first password
  // is allowed without one.
  if (actor.password_hash && !(await verifyPassword(actor.password_hash, current))) {
    return { error: 'Your current password is wrong.' };
  }

  const error = await setAdminPassword(actor.id, next);
  if (error) return { error };

  await writeAdminAudit(actor, 'admin.password.set', { type: 'admin', id: actor.id }, {
    email: actor.email,
    self: true,
  });
  revalidateConsole();
  return { notice: 'Password changed.' };
}
