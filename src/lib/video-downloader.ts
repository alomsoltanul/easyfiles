/**
 * Video Downloader Service
 *
 * Secure wrapper around youtube-dl-exec with:
 * - Strict URL validation before every call
 * - Timeout controls
 * - Controlled options (no arbitrary flags)
 * - Error sanitization
 */

import youtubedl from 'youtube-dl-exec';
import { tmpdir } from 'os';
import { join } from 'path';
import { isAllowedUrl } from './video-security';

const DEFAULT_TIMEOUT = 30000; // 30 seconds for info
const DOWNLOAD_TIMEOUT = 120000; // 2 minutes for download
const MAX_FILE_SIZE_MB = 500; // 500MB limit

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
    // Use dumpSingleJson to get structured metadata
    // Note: we use an untyped object here because some runtime flags may not be in the types
    const flags = {
      dumpSingleJson: true,
      noWarnings: true,
      callHome: false,
      // Limit to avoid abuse
      maxFilesize: `${MAX_FILE_SIZE_MB}M`,
    } as any;

    const result = await youtubedl(url, flags, { timeout: DEFAULT_TIMEOUT });

    // youtube-dl-exec returns parsed JSON when dumpSingleJson is true
    const info = result as unknown as Record<string, any>;

    if (!info || !info.id) {
      throw new Error('Failed to extract video information.');
    }

    // Extract and sanitize formats
    const formats: VideoFormat[] = (info.formats || [])
      .filter((f: any) => {
        // Only include formats with URLs (skip fragmented/DASH-only without URLs)
        if (!f.url) return false;
        // Skip DRM-protected
        if (f.has_drm) return false;
        // Only common containers
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
        // Prefer higher resolution
        const aRes = parseInt(a.quality) || 0;
        const bRes = parseInt(b.quality) || 0;
        return bRes - aRes;
      })[0];

    // Find best audio-only stream
    const bestAudio = formats
      .filter((f) => f.hasAudio && !f.hasVideo)
      .sort((a, b) => {
        // Prefer larger filesize as proxy for quality
        return (b.filesize || 0) - (a.filesize || 0);
      })[0];

    // Sanitize title for safe display and filenames
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
    // Sanitize error before re-throwing to avoid leaking sensitive info
    const message = error?.message || 'Unknown error';
    if (message.includes('PRIVATE') || message.includes('SIGN IN') || message.includes('age')) {
      throw new Error('This video is private, age-restricted, or requires authentication.');
    }
    if (message.includes('not available') || message.includes('removed') || message.includes('copyright')) {
      throw new Error('This video is not available. It may have been removed or blocked.');
    }
    if (message.includes('Invalid or unsupported URL')) {
      throw error; // Pass through our own validation error
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

  // Build strictly controlled options
  // Using `as any` because some runtime flags may not be in the TypeScript types
  const flags: any = {
    output: outputPath,
    noWarnings: true,
    callHome: false,
    restrictFilenames: true,
    // Limit file size to prevent abuse
    maxFilesize: `${MAX_FILE_SIZE_MB}M`,
  };

  if (format === 'audio') {
    flags.extractAudio = true;
    flags.audioFormat = 'mp3';
    flags.audioQuality = 0; // Best
    flags.preferFfmpeg = true;
  } else {
    // Video format selection - strictly controlled
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
    await youtubedl(url, flags, {
      timeout: DOWNLOAD_TIMEOUT,
    });

    return outputPath;
  } catch (error: any) {
    // Cleanup attempt on failure
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

    const result = await youtubedl(url, flags, {
      timeout: DEFAULT_TIMEOUT,
    });

    // Result is the URL string
    const directUrl = typeof result === 'string' ? result.trim() : null;

    if (!directUrl || !directUrl.startsWith('http')) {
      return null;
    }

    return directUrl;
  } catch {
    return null;
  }
}
