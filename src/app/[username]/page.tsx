import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCachedPublicProfile } from '@/lib/profile-links/service';
import { isReservedUsername } from '@/lib/profile-links/constants';
import SocialIconsRow from '@/components/profile-links/SocialIconsRow';
import ProfileLinkCard from '@/components/profile-links/ProfileLinkCard';
import FeaturedToolCard from '@/components/profile-links/FeaturedToolCard';
import ProfileViewBeacon from '@/components/profile-links/ProfileViewBeacon';
import { getSiteUrl } from '@/lib/site';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  if (isReservedUsername(username)) {
    return { title: 'Page Not Found' };
  }

  const data = await getCachedPublicProfile(username);
  if (!data || !data.profile.is_published) {
    return { title: 'User Not Found — ConvertTools' };
  }

  const { profile } = data;
  const siteUrl = getSiteUrl();
  const title = `${profile.display_name} (@${profile.username})`;
  const description =
    profile.bio && profile.bio.trim().length > 0
      ? profile.bio
      : `Check out ${profile.display_name}'s social links, tools and profiles.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${profile.username}`,
      siteName: 'ConvertTools',
      type: 'profile',
      images: profile.avatar_url
        ? [
            {
              url: profile.avatar_url,
              width: 400,
              height: 400,
              alt: profile.display_name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

export default async function UserLinkPage({ params }: PageProps) {
  const { username } = await params;

  if (isReservedUsername(username)) {
    notFound();
  }

  const data = await getCachedPublicProfile(username);

  if (!data || !data.profile.is_published) {
    notFound();
  }

  const { profile, links } = data;
  const theme = profile.theme_config;

  // Background style computation
  const backgroundStyle: React.CSSProperties = {
    color: theme.text_color,
  };

  if (theme.background_type === 'gradient') {
    backgroundStyle.background = theme.background_value;
  } else if (theme.background_type === 'image') {
    backgroundStyle.backgroundImage = `url(${theme.background_value})`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
    backgroundStyle.backgroundAttachment = 'fixed';
  } else {
    backgroundStyle.backgroundColor = theme.background_value;
  }

  const fontClass =
    theme.font === 'serif' ? 'font-serif' : theme.font === 'mono' ? 'font-mono' : 'font-sans';

  // Extract avatar initials
  const initials = profile.display_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 transition-colors duration-300 ${fontClass}`}
      style={backgroundStyle}
    >
      {/* Background overlay for image readability if needed */}
      {theme.background_type === 'image' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none -z-10" />
      )}

      {/* Main Container */}
      <main className="w-full max-w-md mx-auto flex flex-col items-center pt-8 sm:pt-14 pb-10">
        {/* Avatar */}
        <div className="relative mb-4 group">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 shadow-xl transition-transform duration-200 group-hover:scale-105"
              style={{ borderColor: theme.accent_color }}
            />
          ) : (
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl ring-4 shadow-xl select-none"
              style={{
                backgroundColor: theme.card_color,
                color: theme.accent_color,
                borderColor: theme.accent_color,
              }}
            >
              {initials || '@'}
            </div>
          )}
        </div>

        {/* Display Name & Username */}
        <h1 className="text-xl sm:text-2xl font-bold text-center tracking-tight px-2">
          {profile.display_name}
        </h1>
        <p className="text-sm opacity-70 text-center mt-1">@{profile.username}</p>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm sm:text-base text-center mt-3.5 max-w-sm px-4 whitespace-pre-line leading-relaxed opacity-90">
            {profile.bio}
          </p>
        )}

        {/* Social Icons Row */}
        <SocialIconsRow
          socials={profile.social_links}
          textColor={theme.text_color}
          accentColor={theme.accent_color}
        />

        {/* Featured Tool Spotlight */}
        {profile.featured_tool_slug && (
          <div className="w-full px-1">
            <FeaturedToolCard toolSlug={profile.featured_tool_slug} theme={theme} />
          </div>
        )}

        {/* Custom Links Stack */}
        <div className="w-full space-y-3.5 mt-2 px-1">
          {links.length > 0 ? (
            links.map((link) => (
              <ProfileLinkCard key={link.id} link={link} theme={theme} />
            ))
          ) : (
            <div
              className="p-6 text-center rounded-2xl opacity-75 border border-dashed text-sm"
              style={{ borderColor: `${theme.text_color}40` }}
            >
              No links shared yet.
            </div>
          )}
        </div>
      </main>

      {/* Footer Branding Badge */}
      <footer className="w-full max-w-md mx-auto py-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide bg-black/20 hover:bg-black/35 backdrop-blur-md transition-all duration-200 border border-white/10 opacity-80 hover:opacity-100 shadow-sm"
          style={{ color: theme.text_color }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ConvertTools</span>
          <span className="opacity-60">• Create Your Free Link Page</span>
        </Link>
      </footer>

      {/* Non-blocking client beacon to register page views */}
      <ProfileViewBeacon username={profile.username} />
    </div>
  );
}
