import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site';
import ProfileLinkEditor from '@/components/account/profile-link/ProfileLinkEditor';
import type { UserLinkProfile, ProfileLink } from '@/lib/supabase/database.types';

export const metadata: Metadata = {
  title: 'My Link Page — ConvertTools',
  description: 'Customize your personal Linktree-style profile page, links, socials, and theme.',
  robots: { index: false, follow: false },
};

export default async function ProfileLinkPage() {
  const { user, profile: authProfile } = await requireUser('/account/profile-link');
  const supabase = await createSupabaseServerClient();
  const siteUrl = getSiteUrl();

  let linkProfile: UserLinkProfile | null = null;
  let links: ProfileLink[] = [];

  if (supabase) {
    // 1. Fetch user link profile
    const { data: p } = await supabase
      .from('user_link_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (p) {
      linkProfile = p;

      // 2. Fetch links
      const { data: l } = await supabase
        .from('profile_links')
        .select('*')
        .eq('profile_id', p.id)
        .order('position', { ascending: true });

      if (l) {
        links = l;
      }
    } else {
      // Create initial profile state seeded from user account
      const defaultUsername = (authProfile.full_name || authProfile.email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 20);

      linkProfile = {
        id: '',
        user_id: user.id,
        username: defaultUsername || 'creator',
        display_name: authProfile.full_name || 'Creator',
        bio: '',
        avatar_url: authProfile.avatar_url,
        theme_config: {
          theme: 'slate-dark',
          background_type: 'color',
          background_value: '#0f172a',
          card_style: 'rounded',
          card_color: '#1e293b',
          text_color: '#ffffff',
          accent_color: '#38bdf8',
          font: 'sans',
        },
        social_links: {},
        featured_tool_slug: '/image/convert',
        is_published: true,
        view_count: 0,
        created_at: '',
        updated_at: '',
      };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Personal Link Page</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and customize your shareable Linktree hub with your links, socials, and featured tools.
          </p>
        </div>
      </div>

      <ProfileLinkEditor
        initialProfile={linkProfile}
        initialLinks={links}
        siteUrl={siteUrl}
      />
    </div>
  );
}
