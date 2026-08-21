'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

type Client = SupabaseClient<Database>;

let cached: Client | null = null;

/**
 * Browser Supabase client, created once per tab.
 *
 * Returns null when the project is not configured yet so that components can
 * render their signed-out state instead of crashing the page.
 */
export function getSupabaseBrowserClient(): Client | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
