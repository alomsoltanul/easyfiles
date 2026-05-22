import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { Readable } from 'stream';
import { isAllowedUrl, checkRateLimit, sanitizeFileName } from '@/lib/video-security';
import { downloadToTempFile, getDirectDownloadUrl } from '@/lib/video-downloader';

/**
 * POST /api/video/download
 *
 * Securely downloads video or audio.
 *
 * Strategy:
 * 1. Try to download the file server-side using yt-dlp (with ffmpeg-static for MP3)
 * 2. If the file is small enough (< 4.5MB) and downloads within the timeout,
 *    stream it directly back to the client with proper headers.
 * 3. If the file is too large or download times out, fall back to returning
 *    a direct CDN URL that the client can open.
 *
 * This hybrid approach gives reliable downloads for short audio clips while
 * still supporting longer videos via direct URL fallback.
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Extract client IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Rate limit: 10 downloads per minute per IP
    if (!checkRateLimit(ip + ':download')) {
      return NextResponse.json(
        { error: 'Too many download requests. Please slow down and try again in a minute.' },
        { status: 429 }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Send JSON with url and format fields.', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const url = body.url;
    const format = body.format;
    const quality = typeof body.quality === 'string' ? body.quality : undefined;

    // Validation
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required.', code: 'MISSING_URL' }, { status: 400 });
    }

    if (url.trim().length === 0) {
      return NextResponse.json({ error: 'URL cannot be empty.', code: 'URL_EMPTY' }, { status: 400 });
    }

    if (url.length > 2048) {
      return NextResponse.json({ error: 'URL exceeds maximum length.', code: 'URL_LENGTH' }, { status: 400 });
    }

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported URL.', code: 'URL_INVALID' },
        { status: 400 }
      );
    }

    if (!format || (format !== 'video' && format !== 'audio')) {
      return NextResponse.json(
        { error: 'Format must be "video" or "audio".', code: 'FORMAT_INVALID' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Attempt 1: Server-side download (best experience, reliable)
    // ---------------------------------------------------------------
    try {
      const result = await downloadToTempFile(url, format as 'video' | 'audio', quality);
      tempFilePath = result.filePath;

      // Read file stats
      const stats = await stat(tempFilePath);

      if (stats.size === 0) {
        throw new Error('EMPTY_FILE');
      }

      // Create readable stream
      const nodeStream = createReadStream(tempFilePath);

      // Clean up when done streaming
      nodeStream.on('close', async () => {
        if (tempFilePath) {
          try { await unlink(tempFilePath); } catch { /* ignore */ }
        }
      });

      nodeStream.on('error', async () => {
        if (tempFilePath) {
          try { await unlink(tempFilePath); } catch { /* ignore */ }
        }
      });

      // Convert to Web Stream
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      const safeFileName = sanitizeFileName(result.fileName);

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${safeFileName}"`,
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });

    } catch (serverError: any) {
      // Cleanup on server-side failure
      if (tempFilePath) {
        try { await unlink(tempFilePath); } catch { /* ignore */ }
        tempFilePath = null;
      }

      const errMessage = serverError?.message || '';

      // If it's a size or timeout issue, fall back to direct URL
      if (errMessage.includes('FILE_TOO_LARGE') || errMessage.includes('TIMEOUT')) {
        console.log(`Server-side download failed (${errMessage}), falling back to direct URL`);
      } else {
        // For other errors, also try direct URL as last resort
        console.log(`Server-side download error: ${errMessage}, trying direct URL fallback`);
      }
    }

    // ---------------------------------------------------------------
    // Attempt 2: Direct URL fallback
    // ---------------------------------------------------------------
    const directUrl = await getDirectDownloadUrl(url, format as 'video' | 'audio');

    if (!directUrl) {
      return NextResponse.json(
        {
          error: 'Could not get a download URL. The video may be restricted, too large, or use an unsupported format.',
          code: 'NO_DOWNLOAD_URL',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'direct',
      url: directUrl,
      format: format,
      filename: `download.${format === 'audio' ? 'm4a' : 'mp4'}`,
    });

  } catch (error: any) {
    // Final cleanup
    if (tempFilePath) {
      try { await unlink(tempFilePath); } catch { /* ignore */ }
    }

    console.error('Download API fatal error:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5),
    });

    return NextResponse.json(
      { error: 'Download failed unexpectedly. Please try again.', code: 'UNKNOWN' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with a JSON body.' },
    { status: 405 }
  );
}
