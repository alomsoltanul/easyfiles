'use client';

import React, { useState, useCallback, useEffect } from 'react';

interface VideoFormat {
  formatId: string;
  quality: string;
  ext: string;
  filesize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  url: string;
}

interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  webpageUrl: string;
  formats: VideoFormat[];
  bestVideoUrl?: string;
  bestAudioUrl?: string;
  videoExt?: string;
  audioExt?: string;
}

type DownloadFormat = 'video' | 'audio';
type VideoQuality = 'best' | '1080p' | '720p' | '480p' | '360p';

const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  youtube: (
    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  unknown: (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
};

function detectPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('facebook') || hostname.includes('fb.watch')) return 'facebook';
    if (hostname.includes('instagram')) return 'instagram';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export default function VideoDownloader() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('unknown');
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('video');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('best');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Detect platform when URL changes
  useEffect(() => {
    setPlatform(detectPlatform(url));
    setError(null);
  }, [url]);

  const handleFetchInfo = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setIsFetching(true);
    setError(null);
    setVideoInfo(null);
    setStatusMessage('Fetching video information...');

    try {
      const response = await fetch('/api/video/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video information');
      }

      setVideoInfo(data.data);
      setStatusMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch video information');
      setStatusMessage('');
    } finally {
      setIsFetching(false);
    }
  }, [url]);

  const handleDownload = useCallback(async () => {
    if (!videoInfo) return;

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);
    setStatusMessage(downloadFormat === 'audio' ? 'Preparing MP3 download...' : 'Preparing video download...');

    try {
      // For direct downloads (works in all environments including serverless)
      // We use the server to get the direct URL, then client downloads
      const response = await fetch('/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.webpageUrl,
          format: downloadFormat,
          quality: downloadFormat === 'video' ? videoQuality : undefined,
          mode: 'direct',
        }),
      });

      const data = await response.json();

      if (response.ok && data.mode === 'direct' && data.url) {
        // Direct URL mode - trigger browser download
        setStatusMessage('Starting download...');

        const a = document.createElement('a');
        a.href = data.url;
        a.download = data.filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setStatusMessage('Download started!');
        setTimeout(() => setStatusMessage(''), 3000);
      } else if (response.ok) {
        // Server-side streaming
        setStatusMessage(downloadFormat === 'audio' ? 'Converting to MP3...' : 'Downloading video...');

        const downloadResponse = await fetch('/api/video/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: videoInfo.webpageUrl,
            format: downloadFormat,
            quality: downloadFormat === 'video' ? videoQuality : undefined,
            mode: 'server',
          }),
        });

        if (!downloadResponse.ok) {
          const errData = await downloadResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Download failed');
        }

        // Stream to blob and trigger download
        const blob = await downloadResponse.blob();
        const blobUrl = URL.createObjectURL(blob);
        const contentDisposition = downloadResponse.headers.get('content-disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename="')[1]?.replace('"', '') || 'download'
          : `video-${Date.now()}.${downloadFormat === 'audio' ? 'mp3' : 'mp4'}`;

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        setStatusMessage('Download complete!');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        throw new Error(data.error || 'Download failed');
      }
    } catch (err: any) {
      setError(err.message || 'Download failed. Please try again.');
      setStatusMessage('');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [videoInfo, downloadFormat, videoQuality]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      setError('Unable to access clipboard. Please paste manually.');
    }
  }, []);

  const platformIcon = PLATFORM_ICONS[platform] || PLATFORM_ICONS.unknown;
  const isValidUrl = url.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Video Downloader</h1>
          <p className="text-sm text-slate-500 mt-1">
            Download videos and audio from YouTube, Facebook, Instagram, and X
          </p>
        </div>

        {/* URL Input Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Paste Video URL</h2>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {platformIcon}
              <span className="capitalize">{platform === 'unknown' ? 'Waiting for URL...' : platform}</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo()}
              placeholder="https://youtube.com/watch?v=... or https://instagram.com/p/..."
              className={`
                w-full pl-12 pr-24 py-4 rounded-xl border text-sm font-medium transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                ${error && !isFetching && !videoInfo
                  ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500'
                  : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                }
              `}
              disabled={isFetching || isDownloading}
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
              {url && (
                <button
                  onClick={() => { setUrl(''); setVideoInfo(null); setError(null); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Clear"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={handlePaste}
                disabled={isFetching || isDownloading}
                className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Paste from clipboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Supported Platforms */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-slate-500 font-medium">Supported:</span>
            {['YouTube', 'Facebook', 'Instagram', 'X'].map((name) => (
              <span
                key={name}
                className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Fetch Button */}
          <div className="mt-6">
            <button
              onClick={handleFetchInfo}
              disabled={!isValidUrl || isFetching || isDownloading}
              className={`
                w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold transition-all duration-200
                ${isValidUrl && !isFetching && !isDownloading
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {isFetching ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing URL...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Get Video Info
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Video Info + Download Options */}
        {videoInfo && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            {/* Video Preview */}
            <div className="relative aspect-video bg-slate-900 overflow-hidden">
              {videoInfo.thumbnail ? (
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-full h-full object-cover opacity-90"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-white font-bold text-lg leading-snug line-clamp-2 mb-2">
                  {videoInfo.title}
                </h3>
                <div className="flex items-center gap-3 text-white/80 text-xs font-medium">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {videoInfo.uploader}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDuration(videoInfo.duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Download Options */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Format Toggle */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Download Format</h3>
                <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                  <button
                    onClick={() => setDownloadFormat('video')}
                    className={`
                      flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2
                      ${downloadFormat === 'video'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Video (MP4)
                  </button>
                  <button
                    onClick={() => setDownloadFormat('audio')}
                    className={`
                      flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2
                      ${downloadFormat === 'audio'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Audio (MP3)
                  </button>
                </div>
              </div>

              {/* Quality Selector (Video only) */}
              {downloadFormat === 'video' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Video Quality</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {(['best', '1080p', '720p', '480p', '360p'] as VideoQuality[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => setVideoQuality(q)}
                        className={`
                          relative px-2 py-2.5 rounded-lg text-xs font-semibold text-center transition-all duration-200 border
                          ${videoQuality === q
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }
                        `}
                      >
                        {q === 'best' ? 'Best' : q}
                        {q === 'best' && (
                          <span className={`absolute -top-1.5 -right-1.5 text-[8px] font-bold px-1 py-0.5 rounded-full ${videoQuality === 'best' ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                            Auto
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Button */}
              <div className="border-t border-slate-100 pt-6">
                {isDownloading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>{statusMessage || 'Downloading...'}</span>
                      {downloadProgress > 0 && (
                        <span className="text-emerald-600">{downloadProgress}%</span>
                      )}
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${downloadProgress || 30}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download {downloadFormat === 'audio' ? 'MP3' : 'Video'}
                    </button>
                    <button
                      onClick={() => { setVideoInfo(null); setError(null); setStatusMessage(''); }}
                      className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Secure Processing</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              URLs are strictly validated and sanitized. No command injection possible — we only allow trusted platforms.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Multiple Platforms</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Supports YouTube, Facebook, Instagram, and X (Twitter). Just paste the link and download.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Video & Audio</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download videos in MP4 format or extract audio as MP3. Choose your preferred quality.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            URLs are validated and processed securely. No tracking, no logs.
          </p>
        </div>
      </footer>
    </div>
  );
}
