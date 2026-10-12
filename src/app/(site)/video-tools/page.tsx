import type { Metadata } from 'next';
import Link from 'next/link';
import { PLATFORM_THEMES, PLATFORM_PAGES } from '@/components/videoPlatforms';

export const metadata: Metadata = {
  title: 'Video Downloaders — YouTube, Facebook, Instagram, X | ConvertTools',
  description:
    'Free video downloaders for YouTube, Facebook, Instagram and X (Twitter). Save videos as MP4 or extract audio as MP3 — no signup, no watermarks.',
  keywords: ['video downloader', 'youtube downloader', 'facebook video downloader', 'instagram reels downloader', 'twitter video downloader'],
  alternates: { canonical: '/video-tools' },
};

export default function VideoToolsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Video Downloaders</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pick the platform you are downloading from. Each tool streams the file straight to your device — no signup, no watermarks, nothing stored on our servers.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {PLATFORM_PAGES.map((key) => {
          const theme = PLATFORM_THEMES[key];
          return (
            <Link
              key={key}
              href={`/video-tools/${theme.slug}`}
              className={`group bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md ${theme.cardBorder}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${theme.iconBg} ${theme.iconColor}`}>
                {theme.icon}
              </div>
              <h2 className="font-bold text-slate-900">{theme.name} Video Downloader</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{theme.subheading}</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 mt-4 group-hover:gap-2 transition-all">
                Open tool
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-900">Not sure which one?</h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          The <Link href="/video" className="font-semibold text-emerald-600 hover:text-emerald-700">universal downloader</Link> accepts a link
          from any supported platform and figures out the rest.
        </p>
      </div>
    </div>
  );
}
