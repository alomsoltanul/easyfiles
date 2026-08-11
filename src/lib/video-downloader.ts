/**
 * Video Downloader Service
 *
 * Wrapper around yt-dlp with:
 * - Strict URL validation before every call (no shell, argv only)
 * - Timeout controls and per-platform retry strategies
 * - Optional cookie support for platforms that require a session (Instagram)
 * - Short-lived in-process metadata cache so /info and /download agree on
 *   the same CDN URLs — important because CDN links are IP-locked to the
 *   machine that resolved them.
 */

import youtubedl, { create } from 'youtube-dl-exec';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { isAllowedUrl, detectPlatform, sanitizeFileName, type Platform, type Quality } from './video-security';

const IS_VERCEL = process.env.VERCEL === '1';
const INFO_TIMEOUT = IS_VERCEL ? 45_000 : 60_000;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// ===== Binary discovery =====

let cachedFfmpegPath: string | null | undefined;

export function getFfmpegPath(): string | undefined {
  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath ?? undefined;

  const candidates = [
    process.env.FFMPEG_PATH,
    join(process.cwd(), 'bin', 'ffmpeg'),
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    '/var/task/bin/ffmpeg',
    '/var/task/node_modules/ffmpeg-static/ffmpeg',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      cachedFfmpegPath = candidate;
      return candidate;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && existsSync(ffmpegStatic)) {
      cachedFfmpegPath = ffmpegStatic;
      return ffmpegStatic;
    }
  } catch {
    // not installed
  }

  cachedFfmpegPath = null;
  return undefined;
}

function getYtDlpBinaryPath(): string | undefined {
  const candidates = [
    process.env.YT_DLP_PATH,
    join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp_linux'),
    join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
    '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux',
    '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function getYtDlp() {
  const binaryPath = getYtDlpBinaryPath();
  return binaryPath ? create(binaryPath) : youtubedl;
}

// ===== Cookies =====

/**
 * Instagram (and sometimes Facebook / age-gated YouTube) refuse anonymous
 * requests from datacenter IPs. Operators can supply a Netscape-format cookie
 * jar through an env var; it is written to the writable tmp dir once per
 * instance and handed to yt-dlp via --cookies.
 */
const COOKIE_ENV: Record<Platform, string[]> = {
  instagram: ['INSTAGRAM_COOKIES', 'VIDEO_COOKIES_INSTAGRAM'],
  facebook: ['FACEBOOK_COOKIES', 'VIDEO_COOKIES_FACEBOOK'],
  youtube: ['YOUTUBE_COOKIES', 'VIDEO_COOKIES_YOUTUBE'],
  twitter: ['TWITTER_COOKIES', 'VIDEO_COOKIES_TWITTER'],
};

const cookieFileCache = new Map<Platform, string | null>();

function getCookieFile(platform: Platform | 'unknown'): string | undefined {
  if (platform === 'unknown') return undefined;
  if (cookieFileCache.has(platform)) return cookieFileCache.get(platform) ?? undefined;

  const raw = COOKIE_ENV[platform].map((key) => process.env[key]).find((value) => value && value.trim().length > 0);

  if (!raw) {
    cookieFileCache.set(platform, null);
    return undefined;
  }

  let contents = raw.trim();
  // Allow base64 so multi-line cookie jars survive env var editors
  if (!contents.includes('\n') && /^[A-Za-z0-9+/=]+$/.test(contents) && contents.length > 100) {
    try {
      contents = Buffer.from(contents, 'base64').toString('utf8');
    } catch {
      // keep raw
    }
  }
  if (!contents.startsWith('# Netscape')) {
    contents = `# Netscape HTTP Cookie File\n${contents}`;
  }

  try {
    const path = join(tmpdir(), `cookies-${platform}.txt`);
    writeFileSync(path, contents.endsWith('\n') ? contents : `${contents}\n`, { mode: 0o600 });
    cookieFileCache.set(platform, path);
    return path;
  } catch {
    cookieFileCache.set(platform, null);
    return undefined;
  }
}

export function hasCookiesFor(platform: Platform | 'unknown'): boolean {
  return Boolean(getCookieFile(platform));
}

// ===== Types =====

export interface VideoFormat {
  formatId: string;
  ext: string;
  height?: number;
  width?: number;
  fps?: number;
  tbr?: number;
  filesize?: number;
  vcodec: string;
  acodec: string;
  hasAudio: boolean;
  hasVideo: boolean;
  note: string;
  url: string;
}

export interface QualityOption {
  id: Quality;
  label: string;
  height: number;
  /** true when video and audio must be merged server-side with ffmpeg */
  needsMerge: boolean;
  approxSize?: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  webpageUrl: string;
  platform: Platform | 'unknown';
  isLive: boolean;
  formats: VideoFormat[];
  qualities: QualityOption[];
  hasAudioOnly: boolean;
  canConvertMp3: boolean;
}

export type ResolvedDownload =
  | { mode: 'proxy'; url: string; fileName: string; mime: string; headers: Record<string, string> }
  | { mode: 'merge'; videoUrl: string; audioUrl: string; copyAudio: boolean; fileName: string; mime: string; headers: Record<string, string> }
  | { mode: 'mp3'; url: string; fileName: string; mime: string; headers: Record<string, string> };

export class VideoError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ===== yt-dlp execution =====

type Attempt = Record<string, unknown>;

function baseFlags(platform: Platform | 'unknown'): Attempt {
  const flags: Attempt = {
    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
    callHome: false,
    retries: 2,
    socketTimeout: 15,
  };

  const cookieFile = getCookieFile(platform);
  if (cookieFile) flags.cookies = cookieFile;

  const proxy = process.env.VIDEO_PROXY_URL;
  if (proxy) flags.proxy = proxy;

  if (platform !== 'youtube') {
    flags.userAgent = BROWSER_UA;
  }

  return flags;
}

/**
 * YouTube rotates which innertube clients work from datacenter IPs, so each
 * attempt uses a different client set before giving up.
 */
function attemptsFor(platform: Platform | 'unknown'): Attempt[] {
  const base = baseFlags(platform);

  if (platform === 'youtube') {
    return [
      { ...base, extractorArgs: 'youtube:player_client=default,android_vr' },
      { ...base, extractorArgs: 'youtube:player_client=tv,web_safari' },
      { ...base, extractorArgs: 'youtube:player_client=ios,mweb' },
    ];
  }

  if (platform === 'instagram') {
    return [base, { ...base, extractorArgs: 'instagram:api=graphql' }];
  }

  return [base, { ...base }];
}

async function runInfo(url: string, platform: Platform | 'unknown'): Promise<Record<string, unknown>> {
  const ytDlp = getYtDlp();
  const attempts = attemptsFor(platform);
  let lastError: unknown;

  for (const flags of attempts) {
    try {
      const result = await ytDlp(url, flags as never, { timeout: INFO_TIMEOUT });
      const info = (typeof result === 'string' ? JSON.parse(result) : result) as Record<string, unknown>;
      if (info && info.id) return info;
      lastError = new Error('Empty extractor response');
    } catch (error) {
      lastError = error;
      const text = errorText(error);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[yt-dlp attempt failed]', text.slice(0, 600));
      }
      // Not worth retrying with another client — the content itself is gated
      if (/login required|requires authentication|private|not available in your country|removed|deleted/i.test(text)) {
        break;
      }
    }
  }

  throw toVideoError(lastError, platform);
}

function errorText(error: unknown): string {
  const err = error as { message?: string; stderr?: string; stdout?: string };
  return [err?.message, err?.stderr, err?.stdout].filter(Boolean).join('\n');
}

function toVideoError(error: unknown, platform: Platform | 'unknown'): VideoError {
  const text = errorText(error);

  if (/sign in to confirm|not a bot|cookies/i.test(text) && platform === 'youtube') {
    return new VideoError(
      'BOT_CHECK',
      'YouTube is asking this server to verify it is not a bot. Try again in a moment, or try another video.',
      429,
    );
  }
  if (/empty media response|login required|requires authentication|rate.?limit/i.test(text) && platform === 'instagram') {
    return new VideoError(
      'LOGIN_REQUIRED',
      'Instagram requires a logged-in session for this post. Public reels usually work — private or age-restricted posts cannot be downloaded.',
      403,
    );
  }
  if (/login required|requires authentication|private video|members-only/i.test(text)) {
    return new VideoError('LOGIN_REQUIRED', 'This video is private or requires a login, so it cannot be downloaded.', 403);
  }
  if (/age.?restricted|confirm your age/i.test(text)) {
    return new VideoError('AGE_RESTRICTED', 'This video is age-restricted and cannot be downloaded.', 403);
  }
  if (/copyright|removed|deleted|unavailable|not available|404/i.test(text)) {
    return new VideoError('UNAVAILABLE', 'This video is unavailable. It may have been removed, made private, or geo-blocked.', 404);
  }
  if (/no video could be found/i.test(text) && platform === 'twitter') {
    return new VideoError(
      'NO_VIDEO',
      'No video was found in that post. X also hides some media from logged-out visitors, so posts that play in your feed may still fail here.',
      404,
    );
  }
  if (/unsupported url|no video/i.test(text)) {
    return new VideoError('UNSUPPORTED', 'No downloadable video was found at that link. Check the URL and try again.', 400);
  }
  if (/timed out|timeout|ETIMEDOUT/i.test(text)) {
    return new VideoError('TIMEOUT', 'The video took too long to analyse. Try again, or pick a shorter video.', 504);
  }
  if (/ENOENT/i.test(text)) {
    return new VideoError('ENGINE_MISSING', 'The download engine is not available on this server.', 500);
  }

  return new VideoError('EXTRACT_FAILED', 'Could not read this video. Double-check the link and try again.', 502);
}

// ===== Metadata =====

const QUALITY_LADDER: { id: Quality; height: number; label: string }[] = [
  { id: '2160p', height: 2160, label: '4K' },
  { id: '1440p', height: 1440, label: '1440p' },
  { id: '1080p', height: 1080, label: '1080p' },
  { id: '720p', height: 720, label: '720p' },
  { id: '480p', height: 480, label: '480p' },
  { id: '360p', height: 360, label: '360p' },
];

const infoCache = new Map<string, { info: VideoInfo; at: number }>();
const INFO_TTL_MS = 5 * 60 * 1000;
const INFO_CACHE_MAX = 50;

function cacheGet(url: string): VideoInfo | undefined {
  const hit = infoCache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > INFO_TTL_MS) {
    infoCache.delete(url);
    return undefined;
  }
  return hit.info;
}

function cacheSet(url: string, info: VideoInfo): void {
  if (infoCache.size >= INFO_CACHE_MAX) {
    const oldest = [...infoCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) infoCache.delete(oldest[0]);
  }
  infoCache.set(url, { info, at: Date.now() });
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseFormats(raw: unknown): VideoFormat[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((f) => f && typeof f === 'object')
    .map((f) => f as Record<string, unknown>)
    .filter((f) => typeof f.url === 'string' && f.url.startsWith('http') && !f.has_drm)
    .filter((f) => {
      const protocol = String(f.protocol ?? '');
      // HLS/DASH manifests can't be proxied as a single file
      return !protocol.includes('m3u8') && !protocol.includes('dash') && protocol !== 'mhtml';
    })
    .map<VideoFormat>((f) => {
      // Facebook and X often omit codec fields entirely; infer from the other
      // metadata rather than dropping the format as "no video, no audio".
      const hasVideoHints = num(f.height) !== undefined || num(f.width) !== undefined || num(f.fps) !== undefined;
      const hasAudioHints = num(f.abr) !== undefined || num(f.asr) !== undefined;
      const vcodec = f.vcodec == null ? (hasAudioHints && !hasVideoHints ? 'none' : 'unknown') : String(f.vcodec);
      const acodec = f.acodec == null ? 'unknown' : String(f.acodec);
      const heightFromNote = parseInt(String(f.format_note ?? ''), 10);
      const formatId = String(f.format_id ?? 'unknown');
      const heightFromId = /(^|[^0-9])hd([^0-9]|$)/i.test(formatId) ? 720 : /(^|[^0-9])sd([^0-9]|$)/i.test(formatId) ? 360 : undefined;

      return {
        formatId,
        ext: String(f.ext ?? 'mp4').toLowerCase(),
        height: num(f.height) ?? (Number.isFinite(heightFromNote) ? heightFromNote : undefined) ?? heightFromId,
        width: num(f.width),
        fps: num(f.fps),
        tbr: num(f.tbr),
        filesize: num(f.filesize) ?? num(f.filesize_approx),
        vcodec,
        acodec,
        hasVideo: vcodec !== 'none' && vcodec !== 'null',
        hasAudio: acodec !== 'none' && acodec !== 'null',
        note: String(f.format_note ?? ''),
        url: String(f.url),
      };
    });
}

function progressiveFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasVideo && f.hasAudio)
    .sort((a, b) => {
      const extRank = (e: string) => (e === 'mp4' ? 0 : 1);
      const rank = extRank(a.ext) - extRank(b.ext);
      if (rank !== 0) return rank;
      return (b.height ?? 0) - (a.height ?? 0);
    });
}

function videoOnlyFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasVideo && !f.hasAudio)
    .sort((a, b) => {
      const heightDiff = (b.height ?? 0) - (a.height ?? 0);
      if (heightDiff !== 0) return heightDiff;
      // Prefer H.264 in MP4 for maximum device compatibility
      const codecRank = (f: VideoFormat) => (f.vcodec.startsWith('avc') ? 0 : f.ext === 'mp4' ? 1 : 2);
      const rank = codecRank(a) - codecRank(b);
      if (rank !== 0) return rank;
      return (b.tbr ?? 0) - (a.tbr ?? 0);
    });
}

function audioOnlyFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasAudio && !f.hasVideo)
    .sort((a, b) => {
      const extRank = (f: VideoFormat) => (f.ext === 'm4a' ? 0 : f.ext === 'mp3' ? 1 : 2);
      const rank = extRank(a) - extRank(b);
      if (rank !== 0) return rank;
      return (b.tbr ?? 0) - (a.tbr ?? 0);
    });
}

function buildQualities(formats: VideoFormat[], canMerge: boolean): QualityOption[] {
  const progressive = progressiveFormats(formats);
  const videoOnly = videoOnlyFormats(formats);

  const maxProgressive = Math.max(0, ...progressive.map((f) => f.height ?? 0));
  const maxVideoOnly = canMerge ? Math.max(0, ...videoOnly.map((f) => f.height ?? 0)) : 0;
  const maxHeight = Math.max(maxProgressive, maxVideoOnly);

  const options: QualityOption[] = [];

  for (const step of QUALITY_LADDER) {
    if (step.height > maxHeight) continue;
    const bestProgressive = progressive.filter((f) => (f.height ?? 0) <= step.height)[0];
    const bestVideoOnly = videoOnly.filter((f) => (f.height ?? 0) <= step.height)[0];
    const useMerge = canMerge && (bestVideoOnly?.height ?? 0) > (bestProgressive?.height ?? 0);
    const source = useMerge ? bestVideoOnly : bestProgressive;
    if (!source) continue;

    const actualHeight = source.height ?? step.height;

    // Skip a rung when it resolves to the same stream as the previous rung
    if (options.some((o) => o.height === actualHeight)) continue;

    options.push({
      id: step.id,
      // Label by what the file really is, not by the rung it was matched to
      label: actualHeight >= 2160 ? '4K' : `${actualHeight}p`,
      height: actualHeight,
      needsMerge: useMerge,
      approxSize: source.filesize,
    });
  }

  if (options.length > 0) {
    const top = options[0];
    options.unshift({ id: 'best', label: 'Best', height: top.height, needsMerge: top.needsMerge, approxSize: top.approxSize });
  } else if (progressive.length > 0 || videoOnly.length > 0) {
    const fallback = progressive[0] ?? videoOnly[0];
    options.push({
      id: 'best',
      label: 'Best',
      height: fallback.height ?? 0,
      needsMerge: !fallback.hasAudio,
      approxSize: fallback.filesize,
    });
  }

  return options;
}

/**
 * Fetches video metadata. Results are cached briefly so a follow-up download
 * reuses the same (IP-locked) CDN URLs resolved by this instance.
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  if (!isAllowedUrl(url)) {
    throw new VideoError('URL_INVALID', 'Only YouTube, Facebook, Instagram, and X (Twitter) links are supported.', 400);
  }

  const cached = cacheGet(url);
  if (cached) return cached;

  const platform = detectPlatform(url);
  const raw = await runInfo(url, platform);

  // Playlists / multi-item posts: use the first entry
  const entries = raw.entries as Record<string, unknown>[] | undefined;
  const item = Array.isArray(entries) && entries.length > 0 ? { ...raw, ...entries[0] } : raw;

  const formats = parseFormats(item.formats);
  if (formats.length === 0 && typeof item.url === 'string') {
    formats.push({
      formatId: 'direct',
      ext: String(item.ext ?? 'mp4').toLowerCase(),
      height: num(item.height),
      width: num(item.width),
      fps: num(item.fps),
      tbr: num(item.tbr),
      filesize: num(item.filesize) ?? num(item.filesize_approx),
      vcodec: String(item.vcodec ?? 'avc1'),
      acodec: String(item.acodec ?? 'mp4a'),
      hasVideo: true,
      hasAudio: true,
      note: 'direct',
      url: String(item.url),
    });
  }

  if (formats.length === 0) {
    throw new VideoError('NO_STREAM', 'No downloadable stream was found for this link.', 404);
  }

  const canMerge = Boolean(getFfmpegPath());
  const title = String(item.title ?? 'video')
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    .slice(0, 200);

  const info: VideoInfo = {
    id: String(item.id ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60),
    title,
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : '',
    duration: num(item.duration) ?? 0,
    uploader: String(item.uploader ?? item.channel ?? item.uploader_id ?? 'Unknown').slice(0, 100),
    webpageUrl: typeof item.webpage_url === 'string' ? item.webpage_url : url,
    platform,
    isLive: Boolean(item.is_live),
    formats,
    qualities: buildQualities(formats, canMerge),
    hasAudioOnly: audioOnlyFormats(formats).length > 0,
    canConvertMp3: canMerge,
  };

  cacheSet(url, info);
  // Cache under the canonical URL too, so a download request that arrives with
  // the normalized webpage URL still hits the cache.
  if (info.webpageUrl !== url) cacheSet(info.webpageUrl, info);

  return info;
}

// ===== Download resolution =====

function upstreamHeaders(platform: Platform | 'unknown'): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (platform === 'instagram') {
    headers.Referer = 'https://www.instagram.com/';
    headers.Origin = 'https://www.instagram.com';
  } else if (platform === 'facebook') {
    headers.Referer = 'https://www.facebook.com/';
  } else if (platform === 'twitter') {
    headers.Referer = 'https://x.com/';
  }

  return headers;
}

export interface ResolveOptions {
  format: 'video' | 'audio';
  quality?: Quality;
  audioFormat?: 'original' | 'mp3';
}

export async function resolveDownload(url: string, options: ResolveOptions): Promise<ResolvedDownload> {
  const info = await getVideoInfo(url);
  const headers = upstreamHeaders(info.platform);
  const baseName = sanitizeFileName(info.title || 'download');

  if (options.format === 'audio') {
    const audioOnly = audioOnlyFormats(info.formats)[0];
    const audio = audioOnly ?? progressiveFormats(info.formats)[0];
    if (!audio) {
      throw new VideoError('NO_STREAM', 'No audio stream is available for this video.', 404);
    }

    // Platforms that only expose muxed files (Facebook, X) need ffmpeg to strip
    // the video track — handing back the muxed file as ".m4a" would be a lie.
    const mustTranscode = !audioOnly;

    if (options.audioFormat === 'mp3' || mustTranscode) {
      if (!getFfmpegPath()) {
        throw new VideoError(
          'MP3_UNAVAILABLE',
          'Audio extraction is not available on this server right now. Download the video instead.',
          503,
        );
      }
      return { mode: 'mp3', url: audio.url, fileName: `${baseName}.mp3`, mime: 'audio/mpeg', headers };
    }

    const ext = audio.ext === 'webm' || audio.ext === 'opus' ? 'webm' : audio.ext === 'mp3' ? 'mp3' : 'm4a';
    const mime = ext === 'webm' ? 'audio/webm' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
    return { mode: 'proxy', url: audio.url, fileName: `${baseName}.${ext}`, mime, headers };
  }

  const requested = options.quality && options.quality !== 'best' ? parseInt(options.quality, 10) : Number.POSITIVE_INFINITY;
  const progressive = progressiveFormats(info.formats).filter((f) => (f.height ?? 0) <= requested);
  const videoOnly = videoOnlyFormats(info.formats).filter((f) => (f.height ?? 0) <= requested);
  const audio = audioOnlyFormats(info.formats)[0];
  const canMerge = Boolean(getFfmpegPath()) && Boolean(audio);

  const bestProgressive = progressive[0];
  const bestVideoOnly = videoOnly[0];

  if (canMerge && bestVideoOnly && (bestVideoOnly.height ?? 0) > (bestProgressive?.height ?? 0)) {
    return {
      mode: 'merge',
      videoUrl: bestVideoOnly.url,
      audioUrl: audio.url,
      // AAC copies straight into MP4; Opus/Vorbis has to be re-encoded
      copyAudio: audio.acodec.startsWith('mp4a') || audio.ext === 'm4a',
      fileName: `${baseName}-${bestVideoOnly.height ?? 'hd'}p.mp4`,
      mime: 'video/mp4',
      headers,
    };
  }

  const picked = bestProgressive ?? progressiveFormats(info.formats)[0] ?? bestVideoOnly ?? videoOnlyFormats(info.formats)[0];
  if (!picked) {
    throw new VideoError('NO_STREAM', 'No downloadable video stream was found.', 404);
  }

  const ext = picked.ext === 'webm' ? 'webm' : 'mp4';
  const suffix = picked.height ? `-${picked.height}p` : '';
  return {
    mode: 'proxy',
    url: picked.url,
    fileName: `${baseName}${suffix}.${ext}`,
    mime: ext === 'webm' ? 'video/webm' : 'video/mp4',
    headers,
  };
}
