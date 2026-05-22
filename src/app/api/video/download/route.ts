import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { Readable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { isAllowedUrl, checkRateLimit, sanitizeFileName, isValidFormat, sanitizeLogInput } from '@/lib/video-security';
import { downloadVideo, getDirectDownloadUrl } from '@/lib/video-downloader';

/**
 * POST /api/video/download
 *
 * Securely downloads video or audio from supported platforms.
 * Supports two modes:
 * 1. Server-side download + conversion (requires server environment with ffmpeg)
 * 2. Direct URL fallback (returns the CDN URL for client-side download)
 *
 * Security measures:
 * - Rate limiting (stricter than info endpoint: 5 downloads per minute)
 * - Strict URL validation
 * - File size limits enforced in downloader
 * - Temporary file cleanup
 * - Timeout controls
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Extract client IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Stricter rate limit for downloads
    if (!checkRateLimit(ip + ':download')) {
      return NextResponse.json(
        { error: 'Too many download requests. Please slow down and try again later.' },
        { status: 429 }
      );
    }

    // Parse body
    let body: { url?: string; format?: string; quality?: string; mode?: 'server' | 'direct' };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { url, format, quality, mode = 'server' } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    if (url.length > 2048) {
      return NextResponse.json({ error: 'URL exceeds maximum length.' }, { status: 400 });
    }

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported URL.' },
        { status: 400 }
      );
    }

    if (!format || !isValidFormat(format)) {
      return NextResponse.json(
        { error: 'Format must be "video" or "audio".' },
        { status: 400 }
      );
    }

    // Direct URL mode: return the CDN URL for client-side download
    // This works even in serverless environments like Vercel
    if (mode === 'direct') {
      const directUrl = await getDirectDownloadUrl(url, format);
      if (directUrl) {
        return NextResponse.json({
          success: true,
          mode: 'direct',
          url: directUrl,
          filename: `download.${format === 'audio' ? 'mp3' : 'mp4'}`,
        });
      }
      // Fall back to server mode if direct URL not available
    }

    // Server-side download mode
    tempFilePath = await downloadVideo(url, format, quality);

    const stats = await stat(tempFilePath);

    if (stats.size === 0) {
      throw new Error('Downloaded file is empty.');
    }

    // Determine content type
    const contentType = format === 'audio' ? 'audio/mpeg' : 'video/mp4';
    const ext = format === 'audio' ? 'mp3' : 'mp4';

    // Create filename from URL or use a safe default
    const safeFileName = sanitizeFileName(`video-${Date.now()}.${ext}`);

    // Create readable stream and convert to Web Stream
    const nodeStream = createReadStream(tempFilePath);

    // Set up cleanup when stream ends
    nodeStream.on('close', async () => {
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    nodeStream.on('error', async () => {
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    // Convert Node stream to Web stream for Next.js Response
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    // Cleanup temp file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    console.error('Video download API error details:', {
      message: error?.message,
      stderr: error?.stderr,
      stdout: error?.stdout,
      code: error?.exitCode,
      stack: error?.stack?.split('\n').slice(0, 5),
    });

    const message = error?.message || 'Download failed.';

    if (message.includes('FFmpeg')) {
      return NextResponse.json(
        { error: message, fallback: true },
        { status: 500 }
      );
    }

    if (message.includes('restricted') || message.includes('unavailable')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes('exceeds maximum file size')) {
      return NextResponse.json({ error: message }, { status: 413 });
    }

    return NextResponse.json(
      { error: 'Download failed. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * Reject GET requests for the same reason as the info endpoint:
 * URLs in query strings end up in server logs.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with a JSON body.' },
    { status: 405 }
  );
}
