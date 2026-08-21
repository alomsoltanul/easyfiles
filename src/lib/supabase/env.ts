/**
 * Supabase environment access.
 *
 * The site has to keep building and serving all 44 free tools even when no
 * Supabase project is wired up yet, so nothing here throws at import time.
 * Callers check `isSupabaseConfigured()` and degrade to signed-out behaviour.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** Server-only. Throws, because any caller of this is already a privileged path. */
export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return key;
}

export function requireSupabaseUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return SUPABASE_URL;
}
