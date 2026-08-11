import type { Metadata } from 'next';
import Link from 'next/link';
import VideoDownloader from '@/components/VideoDownloader';
import { PLATFORM_THEMES, PLATFORM_PAGES } from '@/components/videoPlatforms';

export const metadata: Metadata = {
  title: 'Video Downloader — YouTube, Facebook, Instagram, X | ConvertTools',
  description:
    'Paste a video link from YouTube, Facebook, Instagram or X and download it as MP4, or extract the audio as MP3. Free, no signup, no watermarks.',
  keywords: ['video downloader', 'mp4 downloader', 'youtube to mp3', 'instagram reels downloader'],
  alternates: { canonical: '/video' },
};

export default function VideoPage() {
  return (
    <>
      <VideoDownloader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Platform-specific downloaders</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLATFORM_PAGES.map((key) => {
            const theme = PLATFORM_THEMES[key];
            return (
              <Link
                key={key}
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
