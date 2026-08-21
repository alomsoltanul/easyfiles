import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

type Client = SupabaseClient<Database>;

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Never cache or share it across requests — it carries the
 * caller's cookies.
 *
 * Returns null when no Supabase project is configured.
 */
export async function createSupabaseServerClient(): Promise<Client | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the
          // session on every request, so dropping the write here is safe.
        }
      },
    },
  });
}
