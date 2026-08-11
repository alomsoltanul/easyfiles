'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PLATFORM_THEMES, type PlatformKey } from './videoPlatforms';

interface QualityOption {
  id: string;
  label: string;
  height: number;
  needsMerge: boolean;
  approxSize?: number;
}

interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  webpageUrl: string;
  platform: string;
  qualities: QualityOption[];
  hasAudioOnly: boolean;
  canConvertMp3: boolean;
}

type DownloadFormat = 'video' | 'audio';

function detectPlatform(url: string): PlatformKey | 'unknown' {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
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
    return `${hours}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

interface VideoDownloaderProps {
  /** Restricts and themes the tool for one platform. Defaults to all platforms. */
  platform?: PlatformKey;
  title?: string;
  description?: string;
}

export default function VideoDownloader({ platform: fixedPlatform, title, description }: VideoDownloaderProps) {
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState<PlatformKey | 'unknown'>(fixedPlatform ?? 'unknown');
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('video');
  const [quality, setQuality] = useState('best');
  const [audioFormat, setAudioFormat] = useState<'original' | 'mp3'>('mp3');
  const [statusMessage, setStatusMessage] = useState('');

  const theme = PLATFORM_THEMES[fixedPlatform ?? (detected === 'unknown' ? 'all' : detected)] ?? PLATFORM_THEMES.all;

  useEffect(() => {
    if (!fixedPlatform) setDetected(url.trim() ? detectPlatform(url) : 'unknown');
    setError(null);
  }, [url, fixedPlatform]);

  const mismatch = useMemo(() => {
    if (!fixedPlatform || !url.trim()) return false;
    const found = detectPlatform(url);
    return found !== 'unknown' && found !== fixedPlatform;
  }, [fixedPlatform, url]);

  const handleFetchInfo = useCallback(async () => {
    if (!url.trim()) {
      setError('Paste a video link first.');
      return;
    }

    setIsFetching(true);
    setError(null);
    setNotice(null);
    setVideoInfo(null);
    setStatusMessage('Reading video…');

    try {
      const response = await fetch('/api/video/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not read that video.');

      const info = data.data as VideoInfo;
      setVideoInfo(info);
      setQuality(info.qualities[0]?.id ?? 'best');
      setAudioFormat(info.canConvertMp3 ? 'mp3' : 'original');
      if (info.qualities.length === 0) {
        setNotice('Only an audio stream is available for this link.');
        setDownloadFormat('audio');
      }
      setStatusMessage('');
    } catch (err) {
      setError((err as Error).message || 'Could not read that video.');
      setStatusMessage('');
    } finally {
      setIsFetching(false);
    }
  }, [url]);

  const handleDownload = useCallback(async () => {
    if (!videoInfo) return;

    setIsDownloading(true);
    setError(null);
    setNotice(null);
    setStatusMessage('Preparing your file…');

    try {
      const prepare = await fetch('/api/video/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.webpageUrl,
          format: downloadFormat,
          quality: downloadFormat === 'video' ? quality : 'best',
          audioFormat: downloadFormat === 'audio' ? audioFormat : 'original',
        }),
      });

      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || 'Could not prepare the download.');

      // Ask the server to resolve the stream first so real errors surface here
      // instead of inside the browser's download manager.
      setStatusMessage('Resolving stream…');
      const probe = await fetch(`${prepared.downloadUrl}&probe=1`);
      const probeData = await probe.json();
      if (!probe.ok) throw new Error(probeData.error || 'The download could not be started.');

      const size = formatSize(probeData.size);
      setStatusMessage(size ? `Downloading ${probeData.fileName} (${size})…` : `Downloading ${probeData.fileName}…`);

      const anchor = document.createElement('a');
      anchor.href = prepared.downloadUrl;
      anchor.download = probeData.fileName || '';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setNotice(
        probeData.mode === 'merge'
          ? 'Merging video and audio — the file will keep growing in your downloads until it finishes.'
          : 'Download started. Check your browser downloads.',
      );
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      setError((err as Error).message || 'Download failed. Please try again.');
      setStatusMessage('');
    } finally {
      setIsDownloading(false);
    }
  }, [videoInfo, downloadFormat, quality, audioFormat]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
    } catch {
      setError('Clipboard access was blocked. Paste the link manually.');
    }
  }, []);

  const qualities = videoInfo?.qualities ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.iconBg}`}>
          <span className={theme.iconColor}>{theme.icon}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title ?? theme.heading}</h1>
          <p className="text-sm text-slate-500 mt-1">{description ?? theme.subheading}</p>
        </div>
      </div>

      {/* URL input */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Paste the video link</h2>
          {!fixedPlatform && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <span className={PLATFORM_THEMES[detected === 'unknown' ? 'all' : detected].iconColor}>
                {PLATFORM_THEMES[detected === 'unknown' ? 'all' : detected].icon}
              </span>
              <span className="capitalize">{detected === 'unknown' ? 'Waiting for link…' : detected === 'twitter' ? 'X' : detected}</span>
            </div>
          )}
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
            placeholder={theme.placeholder}
            className={`w-full pl-12 pr-24 py-4 rounded-xl border text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
              error ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400' : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-400'
            }`}
            disabled={isFetching || isDownloading}
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
            {url && (
              <button
                onClick={() => { setUrl(''); setVideoInfo(null); setError(null); setNotice(null); }}
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
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Paste from clipboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          </div>
        </div>

        {mismatch && (
          <p className="mt-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            That looks like a {detectPlatform(url)} link. It will still work here, or use the matching tool for platform-specific tips.
          </p>
        )}

        <div className="mt-6">
          <button
            onClick={handleFetchInfo}
            disabled={!url.trim() || isFetching || isDownloading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white transition-all duration-200 ${
              url.trim() && !isFetching && !isDownloading ? theme.button : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isFetching ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reading video…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Get download options
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm font-medium">
            {notice}
          </div>
        )}
      </div>

      {/* Result */}
      {videoInfo && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="relative aspect-video bg-slate-900 overflow-hidden">
            {videoInfo.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover opacity-90" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white font-bold text-lg leading-snug line-clamp-2 mb-2">{videoInfo.title}</h3>
              <div className="flex items-center gap-3 text-white/80 text-xs font-medium">
                <span>{videoInfo.uploader}</span>
                <span>{formatDuration(videoInfo.duration)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">What do you want?</h3>
              <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                <button
                  onClick={() => setDownloadFormat('video')}
                  disabled={qualities.length === 0}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 ${
                    downloadFormat === 'video' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Video (MP4)
                </button>
                <button
                  onClick={() => setDownloadFormat('audio')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    downloadFormat === 'audio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Audio only
                </button>
              </div>
            </div>

            {downloadFormat === 'video' && qualities.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Quality</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {qualities.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuality(q.id)}
                      className={`relative px-2 py-2.5 rounded-lg text-xs font-semibold text-center transition-all duration-200 border ${
                        quality === q.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {q.label}
                      <span className="block text-[10px] font-normal opacity-70">
                        {q.id === 'best' ? `${q.height}p` : formatSize(q.approxSize) ?? `${q.height}p`}
                      </span>
                    </button>
                  ))}
                </div>
                {qualities.find((q) => q.id === quality)?.needsMerge && (
                  <p className="text-xs text-slate-500 mt-2">
                    This quality is merged from separate video and audio streams — it takes a little longer to start.
                  </p>
                )}
              </div>
            )}

            {downloadFormat === 'audio' && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Audio format</h3>
                <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                  <button
                    onClick={() => setAudioFormat('mp3')}
                    disabled={!videoInfo.canConvertMp3}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 ${
                      audioFormat === 'mp3' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    MP3
                  </button>
                  <button
                    onClick={() => setAudioFormat('original')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      audioFormat === 'original' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Original (M4A)
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {audioFormat === 'mp3' ? 'Converted on the fly — plays anywhere.' : 'Fastest option: the original audio track, untouched.'}
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6">
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`flex-1 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 ${theme.button}`}
                >
                  {isDownloading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {statusMessage || 'Working…'}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download {downloadFormat === 'audio' ? (audioFormat === 'mp3' ? 'MP3' : 'audio') : 'video'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setVideoInfo(null); setError(null); setNotice(null); setStatusMessage(''); }}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How-to */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">How to download</h2>
        <ol className="space-y-3">
          {theme.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-slate-600">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${theme.iconBg} ${theme.iconColor}`}>
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Good to know</h2>
        <div className="space-y-4">
          {theme.faqs.map((faq) => (
            <div key={faq.q}>
              <h3 className="text-sm font-semibold text-slate-800">{faq.q}</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{faq.a}</p>
            </div>
          ))}
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Is this legal?</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Download only content you own or that is licensed for reuse, and respect each platform&apos;s terms of service.
              This tool is meant for saving your own uploads and openly licensed material.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
