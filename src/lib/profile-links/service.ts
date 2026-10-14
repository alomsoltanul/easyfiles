import 'server-only';

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Database, UserLinkProfile, ProfileLink } from '@/lib/supabase/database.types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env';
import { isReservedUsername } from './constants';

export interface PublicProfileData {
  profile: UserLinkProfile;
  links: ProfileLink[];
}

/**
 * Creates an unauthenticated, public Supabase client without reading user cookies.
 * This ensures the query can be cached at the edge and never de-optimizes SSR/ISR.
 */
function getPublicSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Core query for fetching public profile and its active links.
 */
async function fetchPublicProfileDirect(username: string): Promise<PublicProfileData | null> {
  const normalized = username.toLowerCase().trim();
  if (isReservedUsername(normalized)) return null;

  const supabase = getPublicSupabaseClient();
  if (!supabase) return null;

  // 1. Fetch user link profile
  const { data: profile, error: profileError } = await supabase
    .from('user_link_profiles')
    .select('*')
    .ilike('username', normalized)
    .eq('is_published', true)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  // 2. Fetch active links for this profile ordered by position ascending
  const { data: links, error: linksError } = await supabase
    .from('profile_links')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('position', { ascending: true });

  if (linksError) {
    return {
      profile,
      links: [],
    };
  }

  return {
    profile,
    links: links ?? [],
  };
}

/**
 * High-performance cached public profile fetcher with tag-based on-demand revalidation.
 * Edge-cached for up to 24 hours (86,400s) or until invalidated via revalidateTag('profile-[username]').
 */
export async function getCachedPublicProfile(username: string): Promise<PublicProfileData | null> {
  const normalized = username.toLowerCase().trim();
  if (isReservedUsername(normalized)) return null;

  const getCached = unstable_cache(
    async (u: string) => fetchPublicProfileDirect(u),
    ['public-profile-link', normalized],
    {
      tags: [`profile-${normalized}`],
      revalidate: 86400,
    }
  );

  return getCached(normalized);
}
