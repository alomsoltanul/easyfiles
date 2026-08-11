import React from 'react';

export type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'twitter' | 'all';

export interface PlatformTheme {
  slug: string;
  name: string;
  heading: string;
  subheading: string;
  placeholder: string;
  /** Full Tailwind class strings — never build these dynamically. */
  button: string;
  iconBg: string;
  iconColor: string;
  cardBorder: string;
  icon: React.ReactNode;
  steps: string[];
  faqs: { q: string; a: string }[];
}

const YOUTUBE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const FACEBOOK_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const INSTAGRAM_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const X_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const ALL_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const COMMON_FAQS = [
  {
    q: 'Where does the file come from?',
    a: 'Our server resolves the original stream and pipes it straight to your browser. Nothing is stored: once the transfer ends, the server keeps no copy.',
  },
  {
    q: 'Why is a very long video slow?',
    a: 'The whole file passes through the server, so a 1-hour HD video takes as long as your connection needs. Picking a lower quality or audio-only is much faster.',
  },
];

export const PLATFORM_THEMES: Record<PlatformKey, PlatformTheme> = {
  youtube: {
    slug: 'youtube',
    name: 'YouTube',
    heading: 'YouTube Video Downloader',
    subheading: 'Paste a YouTube link and save the video as MP4 or pull the audio as MP3.',
    placeholder: 'https://www.youtube.com/watch?v=… or https://youtu.be/…',
    button: 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    cardBorder: 'hover:border-red-300',
    icon: YOUTUBE_ICON,
    steps: [
      'Open the video on YouTube and copy the link from the address bar or the Share button.',
      'Paste it above and press “Get download options”.',
      'Choose a quality — or switch to audio-only for MP3.',
      'Hit download; the file streams straight into your browser downloads.',
    ],
    faqs: [
      {
        q: 'Which qualities can I get?',
        a: 'Every resolution the video was uploaded in, up to 4K. Above 360p YouTube stores video and audio separately, so those files are merged on our server before they reach you.',
      },
      {
        q: 'Do Shorts, playlists and music links work?',
        a: 'Shorts and youtu.be links work the same way. A playlist link downloads the first video only — paste individual video links for the rest.',
      },
      ...COMMON_FAQS,
    ],
  },
  facebook: {
    slug: 'facebook',
    name: 'Facebook',
    heading: 'Facebook Video Downloader',
    subheading: 'Save public Facebook videos, Reels and Watch clips as MP4.',
    placeholder: 'https://www.facebook.com/watch/?v=… or https://fb.watch/…',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    cardBorder: 'hover:border-blue-300',
    icon: FACEBOOK_ICON,
    steps: [
      'Open the video on Facebook, tap the three-dot menu and choose “Copy link”.',
      'Paste the link above and press “Get download options”.',
      'Pick SD or HD, or switch to audio-only.',
      'Download — the file saves straight to your device.',
    ],
    faqs: [
      {
        q: 'Which videos work?',
        a: 'Anything set to Public: page videos, Watch clips and public Reels. Posts limited to friends, private groups or your own timeline need a login and cannot be fetched.',
      },
      {
        q: 'The link from the app does not work',
        a: 'Use “Copy link” rather than “Copy text”. Share links that open the app (fb.watch) work too — paste them exactly as copied.',
      },
      ...COMMON_FAQS,
    ],
  },
  instagram: {
    slug: 'instagram',
    name: 'Instagram',
    heading: 'Instagram Video Downloader',
    subheading: 'Save public Instagram Reels, feed videos and IGTV clips as MP4.',
    placeholder: 'https://www.instagram.com/reel/… or https://www.instagram.com/p/…',
    button: 'bg-pink-600 hover:bg-pink-700 shadow-sm shadow-pink-200',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    cardBorder: 'hover:border-pink-300',
    icon: INSTAGRAM_ICON,
    steps: [
      'Open the Reel or post, tap the three-dot menu and choose “Copy link”.',
      'Paste it above and press “Get download options”.',
      'Choose video or audio-only.',
      'Download the file to your device.',
    ],
    faqs: [
      {
        q: 'Why do some Reels fail?',
        a: 'Instagram serves most posts only to logged-in sessions and blocks datacenter traffic hard. Public Reels from business or creator accounts usually work; private accounts, Stories and age-restricted posts never will.',
      },
      {
        q: 'Can I download Stories?',
        a: 'No. Stories require an authenticated session tied to an account that can see them, which this tool deliberately does not use.',
      },
      ...COMMON_FAQS,
    ],
  },
  twitter: {
    slug: 'x',
    name: 'X (Twitter)',
    heading: 'X (Twitter) Video Downloader',
    subheading: 'Save videos and GIFs from public posts on X as MP4.',
    placeholder: 'https://x.com/user/status/… or https://twitter.com/user/status/…',
    button: 'bg-slate-900 hover:bg-slate-800 shadow-sm shadow-slate-300',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-900',
    cardBorder: 'hover:border-slate-400',
    icon: X_ICON,
    steps: [
      'Open the post on X, tap the share icon and choose “Copy link”.',
      'Paste the link above and press “Get download options”.',
      'Pick the resolution you want.',
      'Download — the file streams straight to your device.',
    ],
    faqs: [
      {
        q: 'Do old twitter.com links work?',
        a: 'Yes. twitter.com and x.com status links are handled identically.',
      },
      {
        q: 'Why does a protected post fail?',
        a: 'Posts from protected accounts, or age-restricted media, require a signed-in session and cannot be downloaded.',
      },
      ...COMMON_FAQS,
    ],
  },
  all: {
    slug: 'all',
    name: 'All platforms',
    heading: 'Video Downloader',
    subheading: 'Paste a link from YouTube, Facebook, Instagram or X and save it as MP4 or MP3.',
    placeholder: 'https://youtube.com/watch?v=… or any supported video link',
    button: 'bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-200',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    cardBorder: 'hover:border-emerald-300',
    icon: ALL_ICON,
    steps: [
      'Copy the video link from YouTube, Facebook, Instagram or X.',
      'Paste it above and press “Get download options”.',
      'Choose video quality, or switch to audio-only for MP3.',
      'Download — the file streams straight into your browser downloads.',
    ],
    faqs: [
      {
        q: 'Which platforms are supported?',
        a: 'YouTube (including Shorts), Facebook, Instagram Reels and X (Twitter). Each has a dedicated page with platform-specific tips.',
      },
      ...COMMON_FAQS,
    ],
  },
};

export const PLATFORM_PAGES: PlatformKey[] = ['youtube', 'facebook', 'instagram', 'twitter'];
