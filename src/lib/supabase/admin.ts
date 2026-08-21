import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { requireServiceRoleKey, requireSupabaseUrl } from './env';

type Client = SupabaseClient<Database>;

let cached: Client | null = null;

/**
 * Service-role client. Bypasses every RLS policy, so it belongs only in
 * privileged server paths: the Stripe webhook, admin console mutations and
 * the retention cron.
 *
 * Never import this from a Client Component — the `server-only` guard above
 * turns that into a build error rather than a leaked key.
 */
export function getSupabaseAdminClient(): Client {
  if (!cached) {
    cached = createClient<Database>(requireSupabaseUrl(), requireServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
