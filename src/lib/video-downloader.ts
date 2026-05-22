/**
 * Video Downloader Service
 *
 * Secure wrapper around youtube-dl-exec with:
 * - Strict URL validation before every call
 * - Timeout controls
 * - Controlled options (no arbitrary flags)
 * - Error sanitization
 * - Vercel/serverless compatibility
 */

import youtubedl, { create } from 'youtube-dl-exec';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { isAllowedUrl } from './video-security';

// Vercel serverless functions have a ~10s timeout on Hobby plan
const IS_VERCEL = process.env.VERCEL === '1';
const DEFAULT_TIMEOUT = IS_VERCEL ? 10000 : 30000;
const DOWNLOAD_TIMEOUT = IS_VERCEL ? 10000 : 120000;
const MAX_FILE_SIZE_MB = 500;

// Try to find the correct yt-dlp binary for the platform
function getYtDlpBinaryPath(): string | undefined {
  // Check common locations
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
  // Fallback to default (will use the one in PATH or node_modules)
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

export interface DownloadResult {
  filePath: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

/**
 * Fetches video metadata securely.
 * Throws on invalid URLs, network errors, or extraction failures.
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
      maxFilesize: `${MAX_FILE_SIZE_MB}M`,
    } as any;

    const result = await ytDlp(url, flags, { timeout: DEFAULT_TIMEOUT });

    const info = result as unknown as Record<string, any>;

    if (!info || !info.id) {
      throw new Error('Failed to extract video information.');
    }

    // Extract and sanitize formats
    const formats: VideoFormat[] = (info.formats || [])
      .filter((f: any) => {
        if (!f.url) return false;
        if (f.has_drm) return false;
        const ext = (f.ext || '').toLowerCase();
        return ['mp4', 'webm', 'm4a', 'mp3'].includes(ext);
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

    // Find best video+audio combined stream
    const bestCombined = formats
      .filter((f) => f.hasVideo && f.hasAudio)
      .sort((a, b) => {
        const aRes = parseInt(a.quality) || 0;
        const bRes = parseInt(b.quality) || 0;
        return bRes - aRes;
      })[0];

    // Find best audio-only stream
    const bestAudio = formats
      .filter((f) => f.hasAudio && !f.hasVideo)
      .sort((a, b) => {
        return (b.filesize || 0) - (a.filesize || 0);
      })[0];

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
    const rawStderr = error?.stderr || '';
    const rawStdout = error?.stdout || '';
    const rawCode = error?.exitCode ?? error?.code ?? 'N/A';

    // Log raw error for diagnostics (never exposed to client)
    console.error('yt-dlp raw error:', {
      message: rawMessage,
      stderr: rawStderr,
      stdout: rawStdout?.slice(0, 500),
      exitCode: rawCode,
      binaryPath: getYtDlpBinaryPath() || 'default',
    });

    if (rawMessage.includes('PRIVATE') || rawMessage.includes('SIGN IN') || rawMessage.includes('age')) {
      throw new Error('This video is private, age-restricted, or requires authentication.');
    }
    if (rawMessage.includes('not available') || rawMessage.includes('removed') || rawMessage.includes('copyright')) {
      throw new Error('This video is not available. It may have been removed or blocked.');
    }
    if (rawMessage.includes('Invalid or unsupported URL')) {
      throw error;
    }
    if (rawMessage.includes('ENOENT') || rawMessage.includes('not found') || rawMessage.includes('spawn')) {
      throw new Error('Video extraction binary is not available on this deployment.');
    }
    // Include the original error message in development for debugging
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Failed to fetch video information: ${rawMessage}`);
    }
    throw new Error('Failed to fetch video information. Please check the URL and try again.');
  }
}

/**
 * Downloads video or audio to a temporary file.
 * Only allows controlled options - no arbitrary user input reaches the binary.
 */
export async function downloadVideo(
  url: string,
  format: 'video' | 'audio',
  quality?: string
): Promise<string> {
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid or unsupported URL.');
  }

  const tempDir = tmpdir();
  const safeId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const outputExt = format === 'audio' ? 'mp3' : 'mp4';
  const outputPath = join(tempDir, `dl-${safeId}.${outputExt}`);

  const flags: any = {
    output: outputPath,
    noWarnings: true,
    callHome: false,
    restrictFilenames: true,
    maxFilesize: `${MAX_FILE_SIZE_MB}M`,
  };

  if (format === 'audio') {
    flags.extractAudio = true;
    flags.audioFormat = 'mp3';
    flags.audioQuality = 0;
    flags.preferFfmpeg = true;
  } else {
    switch (quality) {
      case '1080p':
        flags.format = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best';
        break;
      case '720p':
        flags.format = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best';
        break;
      case '480p':
        flags.format = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best';
        break;
      case '360p':
        flags.format = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best';
        break;
      default:
        flags.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    }
    flags.mergeOutputFormat = 'mp4';
  }

  try {
    const ytDlp = getYtDlp();
    await ytDlp(url, flags, { timeout: DOWNLOAD_TIMEOUT });
    return outputPath;
  } catch (error: any) {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    const message = error?.message || '';
    if (message.includes('ffmpeg')) {
      throw new Error('FFmpeg is required for audio conversion. Please install FFmpeg on the server.');
    }
    if (message.includes('max-filesize')) {
      throw new Error('Video exceeds maximum file size limit.');
    }
    throw new Error('Download failed. The video may be restricted or unavailable.');
  }
}

/**
 * Gets a direct download URL for a video without server-side processing.
 * Useful for serverless environments where downloading large files is not feasible.
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
