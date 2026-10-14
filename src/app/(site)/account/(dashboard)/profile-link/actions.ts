'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { getAccount } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isReservedUsername } from '@/lib/profile-links/constants';
import type { ThemeConfig, SocialLinks } from '@/lib/supabase/database.types';

export interface ProfileLinkInput {
  id?: string;
  title: string;
  url: string;
  icon?: string | null;
  is_active: boolean;
  position: number;
}

export interface SaveProfilePayload {
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string | null;
  theme_config: ThemeConfig;
  social_links: SocialLinks;
  featured_tool_slug?: string | null;
  is_published: boolean;
  links: ProfileLinkInput[];
}

export interface ActionResult {
  ok?: boolean;
  error?: string;
  username?: string;
}

/**
 * Checks whether a given handle is valid and available.
 */
export async function checkUsernameAction(username: string): Promise<{ available: boolean; reason?: string }> {
  const account = await getAccount();
  if (!account) return { available: false, reason: 'Signed out' };

  const clean = username.toLowerCase().trim();

  // 1. Format check
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(clean)) {
    return {
      available: false,
      reason: 'Handle must be 3-30 characters with letters, numbers, hyphens or underscores.',
    };
  }

  // 2. Reserved words check
  if (isReservedUsername(clean)) {
    return { available: false, reason: 'This username is reserved.' };
  }

  // 3. Database check
  const supabase = getSupabaseAdminClient();
  const { data: existing, error } = await supabase
    .from('user_link_profiles')
    .select('id, user_id')
    .ilike('username', clean)
    .maybeSingle();

  if (error) {
    return { available: false, reason: 'Could not verify availability.' };
  }

  if (existing && existing.user_id !== account.user.id) {
    return { available: false, reason: 'This handle is already taken.' };
  }

  return { available: true };
}

/**
 * Saves profile data, theme, socials, and links in an atomic transaction-like sync.
 */
export async function saveProfileLinkDataAction(payload: SaveProfilePayload): Promise<ActionResult> {
  const account = await getAccount();
  if (!account) return { error: 'You are signed out. Please sign in and try again.' };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Database service is temporarily unavailable.' };

  const cleanUsername = payload.username.toLowerCase().trim();

  // Validate handle
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(cleanUsername)) {
    return { error: 'Username must be 3 to 30 characters (letters, numbers, hyphens or underscores).' };
  }

  if (isReservedUsername(cleanUsername)) {
    return { error: 'This username is reserved for system routes.' };
  }

  const cleanDisplayName = payload.display_name.trim().slice(0, 60);
  if (cleanDisplayName.length === 0) {
    return { error: 'Please enter a display name.' };
  }

  const cleanBio = (payload.bio ?? '').trim().slice(0, 300);

  // Check if profile exists
  const { data: currentProfile } = await supabase
    .from('user_link_profiles')
    .select('id, username')
    .eq('user_id', account.user.id)
    .maybeSingle();

  let profileId = currentProfile?.id;
  const oldUsername = currentProfile?.username;

  if (currentProfile) {
    // Check if new username conflicts with someone else
    if (oldUsername && oldUsername.toLowerCase() !== cleanUsername) {
      const { data: conflict } = await supabase
        .from('user_link_profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .neq('id', currentProfile.id)
        .maybeSingle();

      if (conflict) {
        return { error: 'That username is already in use by another user.' };
      }
    }

    // Update existing profile
    const { error: updateError } = await supabase
      .from('user_link_profiles')
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: cleanBio,
        avatar_url: payload.avatar_url || null,
        theme_config: payload.theme_config,
        social_links: payload.social_links,
        featured_tool_slug: payload.featured_tool_slug || null,
        is_published: payload.is_published,
      })
      .eq('id', currentProfile.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } else {
    // Insert new profile
    const { data: inserted, error: insertError } = await supabase
      .from('user_link_profiles')
      .insert({
        user_id: account.user.id,
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: cleanBio,
        avatar_url: payload.avatar_url || null,
        theme_config: payload.theme_config,
        social_links: payload.social_links,
        featured_tool_slug: payload.featured_tool_slug || null,
        is_published: payload.is_published,
      })
      .select('id')
      .single();

    if (insertError) {
      return { error: insertError.message };
    }
    profileId = inserted.id;
  }

  if (!profileId) {
    return { error: 'Failed to resolve profile record.' };
  }

  // Synchronize links
  const validLinks = payload.links.filter((l) => l.title.trim() && l.url.trim());

  // 1. Fetch current links to determine what to delete
  const { data: existingLinks } = await supabase
    .from('profile_links')
    .select('id')
    .eq('profile_id', profileId);

  const existingIds = new Set((existingLinks ?? []).map((l) => l.id));
  const keepIds = new Set(validLinks.map((l) => l.id).filter(Boolean) as string[]);

  const idsToDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (idsToDelete.length > 0) {
    await supabase.from('profile_links').delete().in('id', idsToDelete);
  }

  // 2. Upsert links
  for (let idx = 0; idx < validLinks.length; idx++) {
    const link = validLinks[idx];
    const linkData = {
      profile_id: profileId,
      title: link.title.trim().slice(0, 100),
      url: link.url.trim().slice(0, 2000),
      icon: link.icon || null,
      is_active: link.is_active,
      position: idx,
    };

    if (link.id && existingIds.has(link.id)) {
      await supabase.from('profile_links').update(linkData).eq('id', link.id);
    } else {
      await supabase.from('profile_links').insert(linkData);
    }
  }

  // Revalidate edge caches
  revalidateTag(`profile-${cleanUsername}`);
  if (oldUsername && oldUsername !== cleanUsername) {
    revalidateTag(`profile-${oldUsername}`);
  }
  revalidatePath('/account/profile-link');
  revalidatePath(`/${cleanUsername}`);

  return { ok: true, username: cleanUsername };
}

/**
 * AI Action: Generates bio suggestions
 */
export async function generateAIBiosAction(params: {
  name: string;
  niche: string;
  tone: 'professional' | 'casual' | 'creative' | 'bold' | 'minimalist';
  keywords?: string;
}): Promise<{ bios: string[]; error?: string }> {
  const account = await getAccount();
  if (!account) return { bios: [], error: 'Please sign in.' };

  try {
    const { generateAIBios } = await import('@/lib/profile-links/ai');
    const bios = await generateAIBios(params);
    return { bios };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate bios';
    return { bios: [], error: msg };
  }
}

/**
 * AI Action: Generates custom theme from user prompt
 */
export async function generateAIThemeAction(
  prompt: string
): Promise<{ theme?: ThemeConfig; error?: string }> {
  const account = await getAccount();
  if (!account) return { error: 'Please sign in.' };

  try {
    const { generateAITheme } = await import('@/lib/profile-links/ai');
    const theme = await generateAITheme(prompt);
    return { theme };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate theme';
    return { error: msg };
  }
}

/**
 * AI/Smart Action: Scrapes link metadata & suggests icon
 */
export async function scrapeLinkMetadataAction(
  url: string
): Promise<{ title?: string; icon?: string; error?: string }> {
  const account = await getAccount();
  if (!account) return { error: 'Please sign in.' };

  try {
    const { scrapeLinkMetadata } = await import('@/lib/profile-links/ai');
    const meta = await scrapeLinkMetadata(url);
    return { title: meta.title, icon: meta.icon };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to scrape metadata';
    return { error: msg };
  }
}
