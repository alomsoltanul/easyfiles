import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import VideoDownloader from '@/components/VideoDownloader';
import { PLATFORM_THEMES, PLATFORM_PAGES, type PlatformKey } from '@/components/videoPlatforms';

/** URL slug → platform key. Both /x and /twitter resolve to the same tool. */
const SLUG_TO_PLATFORM: Record<string, PlatformKey> = {
  youtube: 'youtube',
  yt: 'youtube',
  facebook: 'facebook',
  fb: 'facebook',
  instagram: 'instagram',
  x: 'twitter',
  twitter: 'twitter',
};

type Props = { params: Promise<{ platform: string }> };

export function generateStaticParams() {
  return Object.keys(SLUG_TO_PLATFORM).map((platform) => ({ platform }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const key = SLUG_TO_PLATFORM[platform];
  if (!key) return {};

  const theme = PLATFORM_THEMES[key];
  return {
    title: `${theme.heading} — Free, No Signup | ConvertTools`,
    description: theme.subheading,
    keywords: [
      `${theme.name.toLowerCase()} video downloader`,
      `download ${theme.name.toLowerCase()} videos`,
      `${theme.name.toLowerCase()} to mp4`,
      `${theme.name.toLowerCase()} to mp3`,
    ],
    alternates: { canonical: `/video-tools/${theme.slug}` },
  };
}

export default async function PlatformDownloaderPage({ params }: Props) {
  const { platform } = await params;
  const key = SLUG_TO_PLATFORM[platform];
  if (!key) notFound();

  const others = PLATFORM_PAGES.filter((p) => p !== key);

  return (
    <>
      <VideoDownloader platform={key} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Other video downloaders</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {others.map((other) => {
            const theme = PLATFORM_THEMES[other];
            return (
              <Link
                key={other}
                href={`/video-tools/${theme.slug}`}
                className={`flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 transition-colors ${theme.cardBorder}`}
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${theme.iconBg} ${theme.iconColor}`}>
                  {theme.icon}
                </span>
                <span className="text-sm font-semibold text-slate-800">{theme.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
