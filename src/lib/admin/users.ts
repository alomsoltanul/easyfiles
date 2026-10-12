import 'server-only';

import bcrypt from 'bcryptjs';
import { getSupabaseAdminClient } from '../supabase/admin';
import type { AdminRole, AdminUser } from '../supabase/database.types';

/**
 * The admin identity store.
 *
 * These rows are the console's own users. They are not in auth.users, carry no
 * plan and no usage, and are only ever reached through the service-role client
 * — public.admin_users has RLS on with no policies, so a customer JWT cannot
 * read a single column of it.
 */

/** bcrypt work factor. 12 is ~250ms on a Vercel function; fine for a login. */
const BCRYPT_ROUNDS = 12;

/** Minimum password length accepted anywhere in the console. */
export const MIN_PASSWORD_LENGTH = 12;

const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, admin: 1, owner: 2 };

export const ADMIN_ROLES: AdminRole[] = ['viewer', 'admin', 'owner'];

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as string[]).includes(value);
}

/** True when `role` is at least as privileged as `minimum`. */
export function roleAtLeast(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Constant-ish time whatever the outcome: an unknown email still runs a bcrypt
 * compare against a dummy hash, so response time does not reveal which emails
 * exist.
 */
/** A real cost-12 hash of a string nobody knows, so the compare actually runs. */
const DUMMY_HASH = '$2b$12$wX3nwE5GdwTeSRG5FFLd7.WwZvQHEOag7oadjpmEdbntcUJ8ZT65y';

export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return 'Use at least one letter and one number.';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('admin_users')
    .select('*')
    .eq('email', normalizeEmail(email))
    .maybeSingle();
  return data ?? null;
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from('admin_users').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true });
  return data ?? [];
}

/** Owners who can still sign in — used to refuse removing the last one. */
export async function countActiveOwners(): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count } = await admin
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .is('disabled_at', null);
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createAdminUser(input: {
  email: string;
  name?: string | null;
  role: AdminRole;
  password?: string | null;
  createdBy?: string | null;
}): Promise<{ user?: AdminUser; error?: string }> {
  const email = normalizeEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That is not an email address.' };

  const password = input.password?.trim() || null;
  if (password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('admin_users')
    .insert({
      email,
      name: input.name?.trim() || null,
      role: input.role,
      password_hash: password ? await hashPassword(password) : null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single();

  // 23505 is unique_violation — the email is already an admin.
  if (error) {
    return { error: error.code === '23505' ? 'That email already has console access.' : error.message };
  }
  return { user: data };
}

export async function setAdminPassword(id: string, password: string): Promise<string | null> {
  const problem = passwordProblem(password);
  if (problem) return problem;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('admin_users')
    .update({ password_hash: await hashPassword(password) })
    .eq('id', id);
  return error?.message ?? null;
}

export async function setAdminRole(id: string, role: AdminRole): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('admin_users').update({ role }).eq('id', id);
  return error?.message ?? null;
}

export async function setAdminDisabled(id: string, disabled: boolean): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('admin_users')
    .update({ disabled_at: disabled ? new Date().toISOString() : null })
    .eq('id', id);
  return error?.message ?? null;
}

/** Clears the password so the account can only sign in with Google. */
export async function clearAdminPassword(id: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('admin_users').update({ password_hash: null }).eq('id', id);
  return error?.message ?? null;
}

/**
 * Binds Google's subject claim on first successful Google sign-in. After that
 * the binding is never overwritten — a changed `sub` for the same email means
 * something is wrong, and refusing is safer than following it.
 */
export async function bindGoogleIdentity(
  user: AdminUser,
  sub: string,
  extras: { name?: string | null; image?: string | null },
): Promise<boolean> {
  if (user.google_sub && user.google_sub !== sub) return false;

  const admin = getSupabaseAdminClient();
  await admin
    .from('admin_users')
    .update({
      google_sub: sub,
      name: user.name ?? extras.name ?? null,
      image_url: extras.image ?? user.image_url,
    })
    .eq('id', user.id);
  return true;
}

export async function recordSuccessfulLogin(id: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', id);
}
