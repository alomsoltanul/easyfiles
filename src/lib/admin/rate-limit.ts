import 'server-only';

import { headers } from 'next/headers';
import { getSupabaseAdminClient } from '../supabase/admin';

/**
 * Login throttling for the console.
 *
 * The console login is the one page on this site that a stranger can reach and
 * guess at, so every attempt is written down and counted. Two independent
 * counters run over the same window: one per email (stops a slow grind against
 * one known admin) and one per IP (stops a spray across many emails).
 *
 * The counters are rows in Postgres rather than memory because Vercel runs many
 * instances — an in-process counter would reset on every cold start and would
 * never see the attempts handled by a sibling instance.
 */

const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 25;

export interface ThrottleVerdict {
  allowed: boolean;
  /** Seconds until the window clears — only set when `allowed` is false. */
  retryAfter: number;
}

const ALLOWED: ThrottleVerdict = { allowed: true, retryAfter: 0 };

/** Best-effort client IP. Vercel always sets x-forwarded-for. */
export async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    null
  );
}

export async function checkLoginThrottle(email: string, ip: string | null): Promise<ThrottleVerdict> {
  const admin = getSupabaseAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const [byEmail, byIp] = await Promise.all([
    admin
      .from('admin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('ok', false)
      .gte('created_at', since),
    ip
      ? admin
          .from('admin_login_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('ip', ip)
          .eq('ok', false)
          .gte('created_at', since)
      : Promise.resolve({ count: 0 }),
  ]);

  const emailCount = byEmail.count ?? 0;
  const ipCount = byIp.count ?? 0;

  if (emailCount >= MAX_PER_EMAIL || ipCount >= MAX_PER_IP) {
    return { allowed: false, retryAfter: WINDOW_MINUTES * 60 };
  }
  return ALLOWED;
}

/**
 * A successful sign-in clears the email's failures, so one fat-fingered evening
 * does not lock the account out the next morning. The successful attempt itself
 * is kept as a record of who signed in from where.
 */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  ok: boolean,
  reason?: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  if (ok) {
    await admin.from('admin_login_attempts').delete().eq('email', email).eq('ok', false);
  }

  await admin.from('admin_login_attempts').insert({
    email,
    ip,
    ok,
    reason: reason ?? null,
  });
}
