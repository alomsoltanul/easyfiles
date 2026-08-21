import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase/env';
import { accessForSlug, type ToolAccess } from './tool-access';

/**
 * Runtime overrides for the tool registry, set from the admin console.
 *
 * Without this the /tools screen would be decorative — the gate has to actually
 * read what an admin changed.
 *
 * Deliberately reads with a plain anon client and no cookies. feature_flags is
 * public by RLS, and touching cookies() here would make every one of the 56
 * tool pages dynamic — the free ones must stay prerendered. Flag changes reach
 * static pages through revalidatePath() in the admin action.
 */

export interface ToolFlagState {
  enabled: boolean;
  access: ToolAccess | null;
}

const TTL_MS = 60_000;

let cache: Map<string, ToolFlagState> | null = null;
let loadedAt = 0;
let inflight: Promise<Map<string, ToolFlagState>> | null = null;

async function load(): Promise<Map<string, ToolFlagState>> {
  const map = new Map<string, ToolFlagState>();
  if (!isSupabaseConfigured()) return map;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.from('feature_flags').select('*').like('key', 'tool:%');
  if (error || !data) return map;

  for (const row of data) {
    const payload = (row.payload ?? {}) as { access?: ToolAccess };
    map.set(row.key.slice('tool:'.length), {
      enabled: row.enabled,
      access: payload.access ?? null,
    });
  }
  return map;
}

async function getFlags(): Promise<Map<string, ToolFlagState>> {
  const fresh = cache && Date.now() - loadedAt < TTL_MS;
  if (fresh && cache) return cache;

  if (!inflight) {
    inflight = load()
      .then((map) => {
        cache = map;
        loadedAt = Date.now();
        return map;
      })
      .catch(() => cache ?? new Map<string, ToolFlagState>())
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drops the cache so an admin sees their change immediately. */
export function invalidateToolFlags(): void {
  cache = null;
  loadedAt = 0;
}

/** The access level in force right now: an admin override, else the default. */
export async function effectiveAccess(slug: string): Promise<ToolAccess> {
  const flags = await getFlags();
  return flags.get(slug)?.access ?? accessForSlug(slug);
}

/** False when an admin has taken this tool offline. */
export async function isToolEnabled(slug: string): Promise<boolean> {
  const flags = await getFlags();
  return flags.get(slug)?.enabled ?? true;
}
