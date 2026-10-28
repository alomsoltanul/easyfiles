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
import {
  isAllowedUrl,
  detectPlatform,
  normalizeUrl,
  sanitizeFileName,
  type Platform,
  type Quality,
} from './video-security';

const IS_VERCEL = process.env.VERCEL === '1';
const INFO_TIMEOUT = IS_VERCEL ? 45_000 : 60_000;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// ===== Binary discovery =====

let cachedFfmpegPath: string | null | undefined;

export function getFfmpegPath(): string | undefined {
  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath ?? undefined;

  const ffmpegBin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [
    process.env.FFMPEG_PATH,
    join(process.cwd(), 'bin', ffmpegBin),
    join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBin),
    '/var/task/bin/ffmpeg',
    '/var/task/node_modules/ffmpeg-static/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
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
    ...(process.platform === 'linux'
      ? [
          join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp_linux'),
          '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux',
        ]
      : []),
    ...(process.platform === 'win32'
      ? [join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe')]
      : [
          join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
          '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp',
        ]),
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
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
  isHls?: boolean;
  httpHeaders?: Record<string, string>;
  languagePreference?: number;
  sourcePreference?: number;
  availableAt?: number;
}

export interface QualityOption {
  id: Quality;
  label: string;
  /** Resolution in "p" — the short side of the frame, so vertical video reads correctly */
  height: number;
  /** true when the file is produced server-side with ffmpeg (merge or re-encode) */
  needsMerge: boolean;
  approxSize?: number;
  /**
   * false when the file will be VP9/AV1/HEVC video. Those play in Chrome and
   * VLC, but QuickTime, iPhones and the stock Windows player show a black
   * picture with sound only — so they are never picked by default.
   */
  compatible: boolean;
  /** Video codec label for display when not H.264 (e.g. "VP9") */
  codec?: string;
  /** true when the source is re-encoded to H.264 because nothing playable exists */
  transcode?: boolean;
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
  | {
      mode: 'proxy';
      url: string;
      fileName: string;
      mime: string;
      headers: Record<string, string>;
      approxSize?: number;
      availableAt?: number;
    }
  | {
      mode: 'merge';
      videoUrl: string;
      videoHeaders: Record<string, string>;
      videoIsHls?: boolean;
      /** Separate audio stream; omitted when the video input already carries audio */
      audioUrl?: string;
      audioHeaders?: Record<string, string>;
      audioIsHls?: boolean;
      copyAudio: boolean;
      /** Re-encode the video track to H.264 instead of stream-copying it */
      transcodeVideo: boolean;
      fileName: string;
      mime: string;
      approxSize?: number;
      availableAt?: number;
    }
  | {
      mode: 'mp3';
      url: string;
      headers: Record<string, string>;
      isHls?: boolean;
      fileName: string;
      mime: string;
      availableAt?: number;
    };

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
    retries: 2,
    socketTimeout: 15,
    cacheDir: join(tmpdir(), 'yt-dlp-cache'),
  };

  // Modern YouTube extraction requires a JS runtime to solve EJS/n-challenges.
  // yt-dlp only auto-enables Deno; explicitly pass the running Node.js binary.
  if (process.execPath) {
    flags.jsRuntimes = `node:${process.execPath}`;
  }

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
 * YouTube rotates which Innertube clients require PO tokens or attach pre-roll
 * ad delays (`available_at`), so prefer `web_embedded,default` (instant, no PO
 * token, with automatic fallback to `tv_samsung,visionos,web` for non-embeddable
 * videos) and fall back further if needed.
 */
function attemptsFor(platform: Platform | 'unknown'): Attempt[] {
  const base = baseFlags(platform);

  if (platform === 'youtube') {
    if (IS_VERCEL && !hasCookiesFor('youtube') && !process.env.VIDEO_PROXY_URL) {
      return [
        { ...base, extractorArgs: 'youtube:player_client=android,ios;player_skip=webpage,configs' },
        { ...base, extractorArgs: 'youtube:player_client=web_embedded,visionos;player_skip=webpage,configs' },
      ];
    }
    return [
      { ...base, extractorArgs: 'youtube:player_client=web_embedded,default' },
      { ...base },
      {
        ...base,
        extractorArgs: 'youtube:player_client=android,ios,visionos;player_skip=webpage,configs',
      },
    ];
  }

  if (platform === 'instagram') {
    return [base, { ...base, extractorArgs: 'instagram:api=graphql' }];
  }

  return [base, { ...base }];
}

function extractItem(raw: Record<string, unknown>): Record<string, unknown> {
  const entries = raw.entries as Record<string, unknown>[] | undefined;
  return Array.isArray(entries) && entries.length > 0 ? { ...raw, ...entries[0] } : raw;
}

async function runInfo(url: string, platform: Platform | 'unknown', canMerge: boolean): Promise<Record<string, unknown>> {
  const ytDlp = getYtDlp();
  const attempts = attemptsFor(platform);
  let lastError: unknown;

  for (const flags of attempts) {
    try {
      const result = await ytDlp(url, flags as never, { timeout: INFO_TIMEOUT });
      const info = (typeof result === 'string' ? JSON.parse(result) : result) as Record<string, unknown>;
      if (info && info.id) {
        const item = extractItem(info);
        const formats = parseFormats(item.formats, canMerge);
        if (formats.length > 0 || typeof item.url === 'string' || Boolean(item.is_live)) {
          return info;
        }
        lastError = new VideoError('NO_STREAM', 'No downloadable stream was found for this link.', 404);
        continue;
      }
      lastError = new Error('Empty extractor response');
    } catch (error) {
      lastError = error;
      const text = errorText(error);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[yt-dlp attempt failed]', text.slice(0, 600));
      }
      if (platform === 'youtube') {
        if (/private video|members-only|has been removed|not available in your country/i.test(text)) {
          break;
        }
        if (
          IS_VERCEL &&
          !hasCookiesFor('youtube') &&
          !process.env.VIDEO_PROXY_URL &&
          /sign in to confirm|not a bot/i.test(text)
        ) {
          break;
        }
      } else if (/login required|requires authentication|private|not available in your country|removed|deleted/i.test(text)) {
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
  if (error instanceof VideoError) return error;
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

export function invalidateVideoInfo(url: string): void {
  const hit = infoCache.get(url);
  infoCache.delete(url);
  const normalized = normalizeUrl(url);
  if (normalized) infoCache.delete(normalized);
  if (hit) {
    infoCache.delete(hit.info.webpageUrl);
    const normalizedWeb = normalizeUrl(hit.info.webpageUrl);
    if (normalizedWeb) infoCache.delete(normalizedWeb);
  }
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseHttpHeaders(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim().length > 0 && !/[\r\n]/.test(value)) {
      headers[key] = value;
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseFormats(raw: unknown, allowHlsFallback: boolean): VideoFormat[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .filter((f) => f && typeof f === 'object')
    .map((f) => f as Record<string, unknown>)
    .filter((f) => typeof f.url === 'string' && f.url.startsWith('http') && !f.has_drm)
    .filter((f) => {
      const protocol = String(f.protocol ?? '');
      const note = String(f.format_note ?? '');
      if (note.includes('MISSING POT')) return false;
      // DASH segment templates and MHTML storyboards can't be streamed directly
      return !protocol.includes('dash') && protocol !== 'mhtml';
    })
    .map<VideoFormat>((f) => {
      const protocol = String(f.protocol ?? '');
      const isHls = protocol.includes('m3u8');
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
        tbr: num(f.tbr) ?? num(f.abr) ?? num(f.vbr),
        filesize: num(f.filesize) ?? num(f.filesize_approx),
        vcodec,
        acodec,
        hasVideo: vcodec !== 'none' && vcodec !== 'null',
        hasAudio: acodec !== 'none' && acodec !== 'null',
        note: String(f.format_note ?? ''),
        url: String(f.url),
        isHls: isHls || undefined,
        httpHeaders: parseHttpHeaders(f.http_headers),
        languagePreference: num(f.language_preference),
        sourcePreference: num(f.source_preference),
        availableAt: num(f.available_at),
      };
    });

  const hasDirectVideo = parsed.some((f) => f.hasVideo && !f.isHls);
  const hasDirectAudio = parsed.some((f) => f.hasAudio && !f.isHls);

  return parsed.filter((f) => {
    if (!f.isHls) return true;
    // Keep HLS playlists only when ffmpeg is present and no direct HTTPS stream exists
    if (!allowHlsFallback) return false;
    if (f.hasVideo && !hasDirectVideo) return true;
    if (f.hasAudio && !f.hasVideo && !hasDirectAudio) return true;
    return false;
  });
}

function delayRank(f: VideoFormat): number {
  return f.availableAt && f.availableAt * 1000 > Date.now() ? 1 : 0;
}

function progressiveFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasVideo && f.hasAudio)
    .sort((a, b) => {
      const hlsRank = (f: VideoFormat) => (f.isHls ? 1 : 0);
      if (hlsRank(a) !== hlsRank(b)) return hlsRank(a) - hlsRank(b);
      const extRank = (e: string) => (e === 'mp4' ? 0 : 1);
      const rank = extRank(a.ext) - extRank(b.ext);
      if (rank !== 0) return rank;
      const heightDiff = (b.height ?? 0) - (a.height ?? 0);
      if (heightDiff !== 0) return heightDiff;
      return delayRank(a) - delayRank(b);
    });
}

function videoOnlyFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasVideo && !f.hasAudio)
    .sort((a, b) => {
      const heightDiff = (b.height ?? 0) - (a.height ?? 0);
      if (heightDiff !== 0) return heightDiff;
      const hlsRank = (f: VideoFormat) => (f.isHls ? 1 : 0);
      if (hlsRank(a) !== hlsRank(b)) return hlsRank(a) - hlsRank(b);
      // Prefer H.264 in MP4 for maximum device compatibility
      const codecRank = (f: VideoFormat) => (f.vcodec.startsWith('avc') ? 0 : f.ext === 'mp4' ? 1 : 2);
      const rank = codecRank(a) - codecRank(b);
      if (rank !== 0) return rank;
      if (delayRank(a) !== delayRank(b)) return delayRank(a) - delayRank(b);
      return (b.tbr ?? 0) - (a.tbr ?? 0);
    });
}

function audioOnlyFormats(formats: VideoFormat[]): VideoFormat[] {
  return formats
    .filter((f) => f.hasAudio && !f.hasVideo)
    .sort((a, b) => {
      // Prefer the original/default language audio over AI auto-dubbed tracks
      const langDiff = (b.languagePreference ?? 0) - (a.languagePreference ?? 0);
      if (langDiff !== 0) return langDiff;
      // Prefer non-DRC audio over dynamic-range-compressed variants
      const drcRank = (f: VideoFormat) => (f.formatId.endsWith('-drc') ? 1 : 0);
      if (drcRank(a) !== drcRank(b)) return drcRank(a) - drcRank(b);
      const hlsRank = (f: VideoFormat) => (f.isHls ? 1 : 0);
      if (hlsRank(a) !== hlsRank(b)) return hlsRank(a) - hlsRank(b);
      const extRank = (f: VideoFormat) => (f.ext === 'm4a' ? 0 : f.ext === 'mp3' ? 1 : 2);
      const rank = extRank(a) - extRank(b);
      if (rank !== 0) return rank;
      if (delayRank(a) !== delayRank(b)) return delayRank(a) - delayRank(b);
      const tbrDiff = (b.tbr ?? 0) - (a.tbr ?? 0);
      if (tbrDiff !== 0) return tbrDiff;
      return (b.sourcePreference ?? 0) - (a.sourcePreference ?? 0);
    });
}

/** Resolution in "p": the short side, so a 720x1280 reel is 720p, not 1280p. */
function resolutionOf(f: VideoFormat): number {
  if (f.width && f.height) return Math.min(f.width, f.height);
  return f.height ?? 0;
}

/**
 * H.264 is the only video codec that plays everywhere (QuickTime, iPhone
 * Photos, the stock Windows player, TVs). Facebook and X progressive files omit
 * codec fields but are H.264 MP4, so "unknown" in an MP4 counts as playable.
 */
function isPlayableEverywhere(f: VideoFormat): boolean {
  const codec = f.vcodec.toLowerCase();
  if (codec.startsWith('avc') || codec.startsWith('h264')) return true;
  if (codec === 'unknown') return f.ext === 'mp4' || f.ext === 'm4v' || f.ext === 'mov';
  return false;
}

function codecLabel(f: VideoFormat): string | undefined {
  const codec = f.vcodec.toLowerCase();
  if (codec.startsWith('vp09') || codec.startsWith('vp9')) return 'VP9';
  if (codec.startsWith('av01')) return 'AV1';
  if (codec.startsWith('hvc1') || codec.startsWith('hev1') || codec.startsWith('hevc')) return 'HEVC';
  if (codec.startsWith('vp8')) return 'VP8';
  return undefined;
}

/** One concrete way of producing a video file. */
interface VideoPlan {
  kind: 'progressive' | 'merge';
  video: VideoFormat;
  audio?: VideoFormat;
  resolution: number;
  compatible: boolean;
  /** Re-encode to H.264 because no playable stream exists at all */
  transcode: boolean;
  approxSize?: number;
}

function videoPlans(formats: VideoFormat[], canMerge: boolean): VideoPlan[] {
  const audio = audioOnlyFormats(formats)[0];
  const plans: VideoPlan[] = progressiveFormats(formats).map((f) => ({
    kind: f.isHls ? 'merge' : 'progressive',
    video: f,
    resolution: resolutionOf(f),
    compatible: isPlayableEverywhere(f),
    transcode: false,
    approxSize: f.filesize,
  }));

  if (canMerge && audio) {
    for (const f of videoOnlyFormats(formats)) {
      plans.push({
        kind: 'merge',
        video: f,
        audio,
        resolution: resolutionOf(f),
        compatible: isPlayableEverywhere(f),
        transcode: false,
        approxSize: f.filesize && audio.filesize ? f.filesize + audio.filesize : f.filesize,
      });
    }
  }

  return plans;
}

function comparePlans(a: VideoPlan, b: VideoPlan): number {
  if (b.resolution !== a.resolution) return b.resolution - a.resolution;
  // Same resolution: a ready-made file beats an ffmpeg merge
  if (a.kind !== b.kind) return a.kind === 'progressive' ? -1 : 1;
  const extRank = (p: VideoPlan) => (p.video.ext === 'mp4' ? 0 : 1);
  if (extRank(a) !== extRank(b)) return extRank(a) - extRank(b);
  return (b.video.tbr ?? 0) - (a.video.tbr ?? 0);
}

/**
 * Picks the plan for a quality rung. Shared by /info (to list rungs) and
 * /download (to serve one), so the two always agree.
 *
 * - Playable H.264 sources always win, even over a sharper VP9/AV1 stream of
 *   the same size. Facebook ships 720x1280 both as H.264 and as VP9; merging
 *   the VP9 one produced MP4s that most players opened as audio-only.
 * - YouTube only serves 1440p/4K as VP9/AV1, so those rungs stay available
 *   when the user explicitly asks for them (flagged in the UI), but never as
 *   the default "Best".
 * - If nothing playable exists at all, the best stream is re-encoded to H.264.
 */
function pickPlan(
  plans: VideoPlan[],
  maxResolution: number,
  platform: Platform | 'unknown',
  isBest: boolean,
  canTranscode: boolean,
): VideoPlan | undefined {
  if (plans.length === 0) return undefined;

  let pool = plans.filter((p) => p.resolution <= maxResolution);
  if (pool.length === 0) {
    const lowest = Math.min(...plans.map((p) => p.resolution));
    pool = plans.filter((p) => p.resolution === lowest);
  }

  const playable = pool.filter((p) => p.compatible).sort(comparePlans)[0];
  const other = pool.filter((p) => !p.compatible).sort(comparePlans)[0];

  if (!playable) {
    if (!other) return undefined;
    return canTranscode ? { ...other, transcode: true } : other;
  }

  if (!isBest && other && platform === 'youtube') {
    const maxPlayable = Math.max(...plans.filter((p) => p.compatible).map((p) => p.resolution));
    if (other.resolution > maxPlayable) return other;
  }

  return playable;
}

function toQualityOption(id: Quality, plan: VideoPlan): QualityOption {
  return {
    id,
    label: id === 'best' ? 'Best' : plan.resolution >= 2160 ? '4K' : `${plan.resolution}p`,
    height: plan.resolution,
    needsMerge: plan.kind === 'merge' || plan.transcode,
    approxSize: plan.transcode ? undefined : plan.approxSize,
    compatible: plan.compatible || plan.transcode,
    codec: plan.compatible || plan.transcode ? undefined : codecLabel(plan.video),
    transcode: plan.transcode || undefined,
  };
}

function buildQualities(formats: VideoFormat[], platform: Platform | 'unknown', canMerge: boolean): QualityOption[] {
  const plans = videoPlans(formats, canMerge);
  if (plans.length === 0) return [];

  const best = pickPlan(plans, Number.POSITIVE_INFINITY, platform, true, canMerge);
  if (!best) return [];

  const maxResolution = Math.max(...plans.map((p) => p.resolution));
  const options: QualityOption[] = [toQualityOption('best', best)];
  const seen = new Set<number>();

  for (const step of QUALITY_LADDER) {
    if (step.height > maxResolution) continue;
    const plan = pickPlan(plans, step.height, platform, false, canMerge);
    if (!plan || seen.has(plan.resolution)) continue;
    seen.add(plan.resolution);
    options.push(toQualityOption(step.id, plan));
  }

  return options;
}

export function parseClenFromUrl(url: string): number | undefined {
  try {
    const clen = new URL(url).searchParams.get('clen');
    return clen && /^\d+$/.test(clen) && Number(clen) > 0 ? Number(clen) : undefined;
  } catch {
    return undefined;
  }
}

export function parseContentRangeTotal(
  contentRange: string | null,
  requestedEnd: number,
  url: string,
): number | undefined {
  const match = contentRange?.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) return parseClenFromUrl(url);
  const start = Number(match[1]);
  const end = Number(match[2]);
  const totalStr = match[3];
  if (totalStr !== '*') {
    const total = Number(totalStr);
    const chunkLen = end - start + 1;
    // Direct CDNs (googlevideo.com) put the full file size after '/'.
    // Range-rewriting proxies (PipedProxy) put chunkLen after '/'.
    if (total > chunkLen) return total;
    if (end < requestedEnd) return end + 1;
  }
  return parseClenFromUrl(url);
}

function extractYouTubeVideoId(inputUrl: string): string | null {
  try {
    const parsed = new URL(inputUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = parsed.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) {
      return /^[A-Za-z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchYouTubePipedFallback(url: string, canMerge: boolean): Promise<VideoInfo | null> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  const configured =
    process.env.PIPED_API_URLS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const instances = configured.length > 0 ? configured : ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks'];

  for (const instance of instances) {
    try {
      const apiUrl = `${instance.replace(/\/+$/, '')}/streams/${videoId}`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as Record<string, unknown>;
      const formats: VideoFormat[] = [];

      if (Array.isArray(data.videoStreams)) {
        for (const raw of data.videoStreams) {
          if (!raw || typeof raw !== 'object') continue;
          const s = raw as Record<string, unknown>;
          if (typeof s.url !== 'string' || !s.url.startsWith('http')) continue;
          const videoOnly = Boolean(s.videoOnly);
          const mime = String(s.mimeType ?? 'video/mp4').toLowerCase();
          const ext = mime.includes('webm') ? 'webm' : 'mp4';
          const heightFromQuality = parseInt(String(s.quality ?? ''), 10);
          const rawHeight = num(s.height);
          const rawWidth = num(s.width);
          const rawFps = num(s.fps);
          const rawBitrate = num(s.bitrate);
          const rawLen = num(s.contentLength);

          formats.push({
            formatId: String(s.itag ?? s.quality ?? 'video'),
            ext,
            height:
              (rawHeight && rawHeight > 0 ? rawHeight : undefined) ??
              (Number.isFinite(heightFromQuality) ? heightFromQuality : undefined),
            width: rawWidth && rawWidth > 0 ? rawWidth : undefined,
            fps: rawFps && rawFps > 0 ? rawFps : undefined,
            tbr: rawBitrate && rawBitrate > 0 ? rawBitrate / 1000 : undefined,
            filesize: (rawLen && rawLen > 0 ? rawLen : undefined) ?? parseClenFromUrl(s.url),
            vcodec: typeof s.codec === 'string' && s.codec ? s.codec : ext === 'mp4' ? 'avc1' : 'vp9',
            acodec: videoOnly ? 'none' : 'mp4a',
            hasVideo: true,
            hasAudio: !videoOnly,
            note: String(s.quality ?? ''),
            url: s.url,
          });
        }
      }

      if (Array.isArray(data.audioStreams)) {
        for (const raw of data.audioStreams) {
          if (!raw || typeof raw !== 'object') continue;
          const s = raw as Record<string, unknown>;
          if (typeof s.url !== 'string' || !s.url.startsWith('http')) continue;
          const mime = String(s.mimeType ?? 'audio/mp4').toLowerCase();
          const ext = mime.includes('webm') || mime.includes('opus') ? 'webm' : mime.includes('mpeg') ? 'mp3' : 'm4a';
          const rawBitrate = num(s.bitrate);
          const rawLen = num(s.contentLength);
          const trackType = String(s.audioTrackType ?? '').toUpperCase();
          const languagePreference = trackType.includes('ORIGINAL') ? 10 : trackType.includes('DUBBED') ? -5 : 0;

          formats.push({
            formatId: String(s.itag ?? s.quality ?? 'audio'),
            ext,
            tbr: rawBitrate && rawBitrate > 0 ? rawBitrate / 1000 : undefined,
            filesize: (rawLen && rawLen > 0 ? rawLen : undefined) ?? parseClenFromUrl(s.url),
            vcodec: 'none',
            acodec: typeof s.codec === 'string' && s.codec ? s.codec : ext === 'm4a' ? 'mp4a' : 'opus',
            hasVideo: false,
            hasAudio: true,
            note: String(s.quality ?? 'audio'),
            url: s.url,
            languagePreference,
          });
        }
      }

      if (formats.length === 0 && canMerge && typeof data.hls === 'string' && data.hls.startsWith('http')) {
        formats.push({
          formatId: 'hls',
          ext: 'mp4',
          vcodec: 'avc1',
          acodec: 'mp4a',
          hasVideo: true,
          hasAudio: true,
          note: 'hls',
          url: data.hls,
          isHls: true,
        });
      }

      if (formats.length === 0) continue;

      const title = String(data.title ?? 'video')
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
        .slice(0, 200);

      return {
        id: videoId,
        title,
        thumbnail: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : '',
        duration: num(data.duration) ?? 0,
        uploader: String(data.uploader ?? 'Unknown').slice(0, 100),
        webpageUrl: `https://www.youtube.com/watch?v=${videoId}`,
        platform: 'youtube',
        isLive: Boolean(data.livestream),
        formats,
        qualities: buildQualities(formats, 'youtube', canMerge),
        hasAudioOnly: audioOnlyFormats(formats).length > 0,
        canConvertMp3: canMerge,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function storeCachedInfo(url: string, info: VideoInfo): void {
  cacheSet(url, info);
  // Cache under the canonical and normalized URLs too, so a download request
  // that arrives with webpageUrl still hits the cache.
  if (info.webpageUrl !== url) cacheSet(info.webpageUrl, info);
  const normalizedWeb = normalizeUrl(info.webpageUrl);
  if (normalizedWeb && normalizedWeb !== url && normalizedWeb !== info.webpageUrl) {
    cacheSet(normalizedWeb, info);
  }
}

/**
 * Fetches video metadata. Results are cached briefly so a follow-up download
 * reuses the same (IP-locked) CDN URLs resolved by this instance.
 */
export async function getVideoInfo(url: string, opts?: { skipCache?: boolean }): Promise<VideoInfo> {
  if (!isAllowedUrl(url)) {
    throw new VideoError('URL_INVALID', 'Only YouTube, Facebook, Instagram, and X (Twitter) links are supported.', 400);
  }

  if (!opts?.skipCache) {
    const cached = cacheGet(url);
    if (cached) return cached;
  }

  const canMerge = Boolean(getFfmpegPath());
  const platform = detectPlatform(url);
  let raw: Record<string, unknown>;
  try {
    raw = await runInfo(url, platform, canMerge);
  } catch (error) {
    if (
      platform === 'youtube' &&
      error instanceof VideoError &&
      (error.code === 'BOT_CHECK' || error.code === 'EXTRACT_FAILED' || error.code === 'NO_STREAM')
    ) {
      const fallback = await fetchYouTubePipedFallback(url, canMerge);
      if (fallback) {
        storeCachedInfo(url, fallback);
        return fallback;
      }
    }
    throw error;
  }

  const item = extractItem(raw);

  const formats = parseFormats(item.formats, canMerge);
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
      isHls: String(item.protocol ?? '').includes('m3u8') || undefined,
      httpHeaders: parseHttpHeaders(item.http_headers),
      availableAt: num(item.available_at),
    });
  }

  if (formats.length === 0) {
    throw new VideoError('NO_STREAM', 'No downloadable stream was found for this link.', 404);
  }

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
    qualities: buildQualities(formats, platform, canMerge),
    hasAudioOnly: audioOnlyFormats(formats).length > 0,
    canConvertMp3: canMerge,
  };

  storeCachedInfo(url, info);
  return info;
}

// ===== Download resolution =====

function setHeaderCaseInsensitive(target: Record<string, string>, key: string, value: string): void {
  const lower = key.toLowerCase();
  for (const existing of Object.keys(target)) {
    if (existing.toLowerCase() === lower && existing !== key) {
      delete target[existing];
    }
  }
  target[key] = value;
}

function upstreamHeaders(platform: Platform | 'unknown', formatHeaders?: Record<string, string>): Record<string, string> {
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

  // Per-format headers from yt-dlp (crucial for YouTube, where googlevideo.com
  // validates that User-Agent matches the signed c= Innertube client).
  if (formatHeaders) {
    for (const [key, value] of Object.entries(formatHeaders)) {
      setHeaderCaseInsensitive(headers, key, value);
    }
  }

  return headers;
}

export interface ResolveOptions {
  format: 'video' | 'audio';
  quality?: Quality;
  audioFormat?: 'original' | 'mp3';
  skipCache?: boolean;
}

export async function resolveDownload(url: string, options: ResolveOptions): Promise<ResolvedDownload> {
  const info = await getVideoInfo(url, { skipCache: options.skipCache });
  const baseName = sanitizeFileName(info.title || 'download');

  if (options.format === 'audio') {
    const audioOnly = audioOnlyFormats(info.formats)[0];
    const audio = audioOnly ?? progressiveFormats(info.formats)[0];
    if (!audio) {
      throw new VideoError('NO_STREAM', 'No audio stream is available for this video.', 404);
    }

    const headers = upstreamHeaders(info.platform, audio.httpHeaders);
    // Platforms that only expose muxed files (Facebook, X) or HLS playlists need
    // ffmpeg to extract/mux the audio track.
    const mustTranscode = !audioOnly || Boolean(audio.isHls);

    if (options.audioFormat === 'mp3' || mustTranscode) {
      if (!getFfmpegPath()) {
        throw new VideoError(
          'MP3_UNAVAILABLE',
          'Audio extraction is not available on this server right now. Download the video instead.',
          503,
        );
      }
      return {
        mode: 'mp3',
        url: audio.url,
        headers,
        isHls: audio.isHls,
        fileName: `${baseName}.mp3`,
        mime: 'audio/mpeg',
        availableAt: audio.availableAt,
      };
    }

    const ext = audio.ext === 'webm' || audio.ext === 'opus' ? 'webm' : audio.ext === 'mp3' ? 'mp3' : 'm4a';
    const mime = ext === 'webm' ? 'audio/webm' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
    return {
      mode: 'proxy',
      url: audio.url,
      fileName: `${baseName}.${ext}`,
      mime,
      headers,
      approxSize: audio.filesize,
      availableAt: audio.availableAt,
    };
  }

  const canMerge = Boolean(getFfmpegPath());
  const plans = videoPlans(info.formats, canMerge);
  const isBest = !options.quality || options.quality === 'best';
  const requested = isBest ? Number.POSITIVE_INFINITY : parseInt(options.quality as string, 10);
  const plan = pickPlan(plans, requested, info.platform, isBest, canMerge);

  if (!plan) {
    throw new VideoError('NO_STREAM', 'No downloadable video stream was found.', 404);
  }

  const suffix = plan.resolution ? `-${plan.resolution}p` : '';
  const videoHeaders = upstreamHeaders(info.platform, plan.video.httpHeaders);

  if (plan.kind === 'merge' || plan.transcode || plan.video.isHls) {
    const audio = plan.audio;
    const availableAt = Math.max(plan.video.availableAt ?? 0, audio?.availableAt ?? 0) || undefined;
    return {
      mode: 'merge',
      videoUrl: plan.video.url,
      videoHeaders,
      videoIsHls: plan.video.isHls,
      audioUrl: audio?.url,
      audioHeaders: audio ? upstreamHeaders(info.platform, audio.httpHeaders) : undefined,
      audioIsHls: audio?.isHls,
      copyAudio: audio ? !audio.isHls && (audio.acodec.startsWith('mp4a') || audio.ext === 'm4a') : !plan.video.isHls,
      transcodeVideo: plan.transcode,
      fileName: `${baseName}${suffix}.mp4`,
      mime: 'video/mp4',
      approxSize: plan.transcode ? undefined : plan.approxSize,
      availableAt,
    };
  }

  const ext = plan.video.ext === 'webm' ? 'webm' : 'mp4';
  return {
    mode: 'proxy',
    url: plan.video.url,
    fileName: `${baseName}${suffix}.${ext}`,
    mime: ext === 'webm' ? 'video/webm' : 'video/mp4',
    headers: videoHeaders,
    approxSize: plan.approxSize,
    availableAt: plan.video.availableAt,
  };
}

/**
 * Some YouTube Innertube clients (e.g. tv_samsung) return an `available_at`
 * Unix timestamp 5s in the future when YouTube attaches a skippable pre-roll
 * ad; requesting bytes earlier returns HTTP 403 from googlevideo.com.
 */
export async function waitUntilAvailable(availableAt?: number, signal?: AbortSignal): Promise<void> {
  if (!availableAt) return;
  const waitMs = Math.ceil(availableAt * 1000 - Date.now() + 300);
  if (waitMs <= 0 || waitMs > 25_000) return;

  await new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, waitMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function probeRange(url: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number; size?: number }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...headers, Range: 'bytes=0-1' },
      cache: 'no-store',
    });
    // Drain tiny body to release socket cleanly
    await res.arrayBuffer().catch(() => undefined);
    if (!res.ok) return { ok: false, status: res.status };
    const size =
      res.status === 206
        ? parseContentRangeTotal(res.headers.get('content-range'), 1, url)
        : Number(res.headers.get('content-length')) || parseClenFromUrl(url);
    return { ok: true, status: res.status, size };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function verifyResolvedStreams(resolved: ResolvedDownload): Promise<{ ok: boolean; status: number; size?: number }> {
  await waitUntilAvailable(resolved.availableAt);

  if (resolved.mode === 'proxy') {
    const res = await probeRange(resolved.url, resolved.headers);
    return { ok: res.ok, status: res.status, size: res.size ?? resolved.approxSize };
  }

  if (resolved.mode === 'mp3') {
    if (resolved.isHls) return { ok: true, status: 200 };
    const res = await probeRange(resolved.url, resolved.headers);
    return { ok: res.ok, status: res.status };
  }

  const checks = await Promise.all([
    resolved.videoIsHls
      ? Promise.resolve({ ok: true, status: 200, size: undefined })
      : probeRange(resolved.videoUrl, resolved.videoHeaders),
    resolved.audioUrl && !resolved.audioIsHls
      ? probeRange(resolved.audioUrl, resolved.audioHeaders ?? resolved.videoHeaders)
      : Promise.resolve({ ok: true, status: 200, size: undefined }),
  ]);

  const failed = checks.find((c) => !c.ok);
  if (failed) return { ok: false, status: failed.status };

  const size =
    checks[0].size && checks[1].size ? checks[0].size + checks[1].size : checks[0].size ?? resolved.approxSize;
  return { ok: true, status: 200, size };
}

/**
 * Resolves and verifies upstream stream reachability. If cached CDN links have
 * expired or been rejected (e.g. HTTP 403), invalidates the cache and refreshes
 * once before failing.
 */
export async function resolveVerifiedDownload(
  url: string,
  options: ResolveOptions,
): Promise<{ resolved: ResolvedDownload; size?: number }> {
  let resolved = await resolveDownload(url, options);
  let check = await verifyResolvedStreams(resolved);

  if (!check.ok && !options.skipCache) {
    invalidateVideoInfo(url);
    resolved = await resolveDownload(url, { ...options, skipCache: true });
    check = await verifyResolvedStreams(resolved);
  }

  if (!check.ok) {
    throw new VideoError(
      'UPSTREAM_FAILED',
      check.status
        ? `The source refused the download (HTTP ${check.status}). Fetch the video info again.`
        : 'Could not reach the upstream media stream. Please try again.',
      502,
    );
  }

  return { resolved, size: check.size };
}
