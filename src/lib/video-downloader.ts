/**
 * Video Downloader Service
 *
 * Secure wrapper around youtube-dl-exec with:
 * - Strict URL validation before every call
 * - Timeout controls
 * - Controlled options (no arbitrary flags)
 * - ffmpeg-static integration for MP3 conversion
 * - Vercel serverless compatibility (10s timeout, 4.5MB response limit)
 */

import youtubedl, { create } from 'youtube-dl-exec';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { isAllowedUrl } from './video-security';

// Vercel serverless functions have a ~10s timeout on Hobby plan
const IS_VERCEL = process.env.VERCEL === '1';
const DEFAULT_TIMEOUT = IS_VERCEL ? 8000 : 30000;     // 8s on Vercel
const DOWNLOAD_TIMEOUT = IS_VERCEL ? 8000 : 120000;   // 8s on Vercel
const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;        // 4.5MB Vercel limit

// Try to find ffmpeg binary in multiple locations
function getFfmpegPath(): string | undefined {
  const candidates = [
    // Location copied by prebuild script
    join(process.cwd(), 'bin', 'ffmpeg'),
    // ffmpeg-static package
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    // Lambda/Vercel runtime paths
    '/var/task/bin/ffmpeg',
    '/var/task/node_modules/ffmpeg-static/ffmpeg',
    // System paths
    'ffmpeg',
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort: try requiring ffmpeg-static dynamically
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
    // Not available
  }

  return undefined;
}

// Try to find the correct yt-dlp binary for the platform
function getYtDlpBinaryPath(): string | undefined {
  const candidates = [
    join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp_linux'),
    join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
    join(__dirname, '..', '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp_linux'),
    join(__dirname, '..', '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
    '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux',
    '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp',
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

// Create a youtube-dl instance with the explicit binary path
function getYtDlp() {
  const binaryPath = getYtDlpBinaryPath();
  if (binaryPath) {
    return create(binaryPath);
  }
  return youtubedl;
}

export interface VideoFormat {
  formatId: string;
  quality: string;
  ext: string;
  filesize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  url: string;
}

export interface VideoInfo {
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

export interface DownloadOptions {
  url: string;
  format: 'video' | 'audio';
  quality?: string;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

/**
 * Fetches video metadata securely.
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid or unsupported URL. Only YouTube, Facebook, Instagram, and X (Twitter) URLs are allowed.');
  }

  try {
    const ytDlp = getYtDlp();

    const flags = {
      dumpSingleJson: true,
      noWarnings: true,
      callHome: false,
    } as any;

    const result = await ytDlp(url, flags, { timeout: DEFAULT_TIMEOUT });
    const info = result as unknown as Record<string, any>;

    if (!info || !info.id) {
      throw new Error('Failed to extract video information.');
    }

    const formats: VideoFormat[] = (info.formats || [])
      .filter((f: any) => {
        if (!f.url) return false;
        if (f.has_drm) return false;
        const ext = (f.ext || '').toLowerCase();
        return ['mp4', 'webm', 'm4a', 'mp3', '3gp'].includes(ext);
      })
      .map((f: any) => ({
        formatId: String(f.format_id || 'unknown'),
        quality: String(f.quality_label || f.format_note || f.quality || 'unknown'),
        ext: String(f.ext || 'mp4').toLowerCase(),
        filesize: typeof f.filesize === 'number' ? f.filesize : undefined,
        hasAudio: f.acodec !== 'none' && f.acodec !== null,
        hasVideo: f.vcodec !== 'none' && f.vcodec !== null,
        url: String(f.url),
      }));

    const bestCombined = formats
      .filter((f) => f.hasVideo && f.hasAudio)
      .sort((a, b) => {
        const aRes = parseInt(a.quality) || 0;
        const bRes = parseInt(b.quality) || 0;
        return bRes - aRes;
      })[0];

    const bestAudio = formats
      .filter((f) => f.hasAudio && !f.hasVideo)
      .sort((a, b) => (b.filesize || 0) - (a.filesize || 0))[0];

    const title = String(info.title || 'video')
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
      .slice(0, 200);

    return {
      id: String(info.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50),
      title,
      thumbnail: String(info.thumbnail || ''),
      duration: typeof info.duration === 'number' ? info.duration : 0,
      uploader: String(info.uploader || info.channel || 'Unknown').slice(0, 100),
      webpageUrl: String(info.webpage_url || url),
      formats,
      bestVideoUrl: bestCombined?.url,
      bestAudioUrl: bestAudio?.url || bestCombined?.url,
      videoExt: bestCombined?.ext || 'mp4',
      audioExt: bestAudio?.ext || bestCombined?.ext || 'm4a',
    };
  } catch (error: any) {
    const rawMessage = error?.message || 'Unknown error';
    if (rawMessage.includes('PRIVATE') || rawMessage.includes('SIGN IN') || rawMessage.includes('age')) {
      throw new Error('This video is private, age-restricted, or requires authentication.');
    }
    if (rawMessage.includes('not available') || rawMessage.includes('removed') || rawMessage.includes('copyright')) {
      throw new Error('This video is not available. It may have been removed or blocked.');
    }
    if (rawMessage.includes('Invalid or unsupported URL')) {
      throw error;
    }
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Failed to fetch video information: ${rawMessage}`);
    }
    throw new Error('Failed to fetch video information. Please check the URL and try again.');
  }
}

/**
 * Downloads video or audio to a temporary file.
 * Returns the file path, name, content type, and size.
 * Throws if the file exceeds MAX_FILE_SIZE_BYTES or times out.
 */
export async function downloadToTempFile(
  url: string,
  format: 'video' | 'audio',
  quality?: string
): Promise<DownloadResult> {
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid or unsupported URL.');
  }

  const tempDir = tmpdir();
  const safeId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  // For audio with ffmpeg available: convert to mp3
  // Otherwise keep native format (m4a/webm for audio, mp4 for video)
  const ffmpegPath = getFfmpegPath();
  const wantsMp3 = format === 'audio' && ffmpegPath;
  const outputExt = wantsMp3 ? 'mp3' : (format === 'audio' ? 'm4a' : 'mp4');
  const outputPath = join(tempDir, `dl-${safeId}.${outputExt}`);

  const flags: any = {
    output: outputPath,
    noWarnings: true,
    callHome: false,
    restrictFilenames: true,
    // Skip if estimated file size is over limit
    maxFilesize: `${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}M`,
  };

  // Add ffmpeg location if available
  if (ffmpegPath) {
    flags.ffmpegLocation = ffmpegPath;
  }

    if (format === 'audio') {
    if (ffmpegPath) {
      // Convert to MP3 using ffmpeg at 128kbps to stay under Vercel's 4.5MB limit
      // 128kbps = ~1MB per minute, so a 4-minute song fits
      flags.extractAudio = true;
      flags.audioFormat = 'mp3';
      flags.audioQuality = 7; // ~100kbps VBR — keeps files under 4.5MB for most songs up to ~5min
      flags.preferFfmpeg = true;
    } else {
      // No ffmpeg: download best audio stream as-is
      flags.format = 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best';
    }
  } else {
    // Video: choose quality-based pre-merged format
    switch (quality) {
      case '1080p':
        flags.format = 'best[height<=1080][filesize<5M][ext=mp4]/best[height<=1080][ext=mp4]/best[ext=mp4]/best';
        break;
      case '720p':
        flags.format = 'best[height<=720][filesize<5M][ext=mp4]/best[height<=720][ext=mp4]/best[ext=mp4]/best';
        break;
      case '480p':
        flags.format = 'best[height<=480][filesize<5M][ext=mp4]/best[height<=480][ext=mp4]/best[ext=mp4]/best';
        break;
      case '360p':
        flags.format = 'best[height<=360][filesize<5M][ext=mp4]/best[height<=360][ext=mp4]/best[ext=mp4]/best';
        break;
      default:
        flags.format = 'best[filesize<5M][ext=mp4]/best[ext=mp4]/best';
    }
  }

  try {
    const ytDlp = getYtDlp();
    await ytDlp(url, flags, { timeout: DOWNLOAD_TIMEOUT });

    // Check if file was created
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    if (stats.size === 0) {
      throw new Error('Downloaded file is empty.');
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      // Clean up oversized file
      try {
        const { unlink } = await import('fs/promises');
        await unlink(outputPath);
      } catch {
        // ignore
      }
      throw new Error('FILE_TOO_LARGE');
    }

    const contentType = wantsMp3 ? 'audio/mpeg' : format === 'audio' ? 'audio/mp4' : 'video/mp4';

    return {
      filePath: outputPath,
      fileName: `download.${outputExt}`,
      contentType,
      fileSize: stats.size,
    };
  } catch (error: any) {
    // Cleanup on failure
    try {
      const { unlink } = await import('fs/promises');
      await unlink(outputPath);
    } catch {
      // ignore cleanup errors
    }

    const message = error?.message || '';
    if (message.includes('FILE_TOO_LARGE') || message.includes('max-filesize')) {
      throw new Error('FILE_TOO_LARGE');
    }
    if (message.includes('ffmpeg')) {
      throw new Error('FFmpeg is required for audio conversion but was not found.');
    }
    if (message.includes('timeout') || message.includes('Timed out')) {
      throw new Error('TIMEOUT');
    }
    throw new Error('Download failed. The video may be restricted, too large, or unavailable.');
  }
}

/**
 * Gets a direct download URL for a video.
 * Useful for large files where server-side proxying won't work.
 */
export async function getDirectDownloadUrl(url: string, format: 'video' | 'audio'): Promise<string | null> {
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid or unsupported URL.');
  }

  try {
    const ytDlp = getYtDlp();
    const flags: any = {
      getUrl: true,
      noWarnings: true,
      callHome: false,
    };

    if (format === 'audio') {
      flags.format = 'bestaudio/best';
    } else {
      flags.format = 'best[ext=mp4]/best';
    }

    const result = await ytDlp(url, flags, { timeout: DEFAULT_TIMEOUT });
    const directUrl = typeof result === 'string' ? result.trim() : null;

    if (!directUrl || !directUrl.startsWith('http')) {
      return null;
    }

    return directUrl;
  } catch {
    return null;
  }
}
