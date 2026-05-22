import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl, checkRateLimit, isValidFormat } from '@/lib/video-security';
import { getDirectDownloadUrl } from '@/lib/video-downloader';

/**
 * POST /api/video/download
 *
 * Returns a direct CDN download URL for the video/audio stream.
 * On Vercel/serverless, we ONLY support direct mode (no server-side conversion).
 *
 * Security measures:
 * - Rate limiting
 * - Strict URL validation
 * - No arbitrary binary flags
 */
export async function POST(request: NextRequest) {
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

    // Parse body with explicit error
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Send JSON with url and format fields.' },
        { status: 400 }
      );
    }

    const url = body.url;
    const format = body.format;

    // --- Validation with specific error messages ---

    if (!url) {
      return NextResponse.json({ error: 'URL is required.', code: 'MISSING_URL' }, { status: 400 });
    }

    if (typeof url !== 'string') {
      return NextResponse.json({ error: 'URL must be a string.', code: 'URL_TYPE' }, { status: 400 });
    }

    if (url.trim().length === 0) {
      return NextResponse.json({ error: 'URL cannot be empty.', code: 'URL_EMPTY' }, { status: 400 });
    }

    if (url.length > 2048) {
      return NextResponse.json({ error: 'URL exceeds maximum length (2048 chars).', code: 'URL_LENGTH' }, { status: 400 });
    }

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported URL. Only YouTube, Facebook, Instagram, and X URLs are allowed.', code: 'URL_INVALID' },
        { status: 400 }
      );
    }

    if (!format) {
      return NextResponse.json({ error: 'Format is required.', code: 'MISSING_FORMAT' }, { status: 400 });
    }

    if (typeof format !== 'string' || !isValidFormat(format)) {
      return NextResponse.json(
        { error: 'Format must be "video" or "audio".', code: 'FORMAT_INVALID' },
        { status: 400 }
      );
    }

    // Get direct download URL
    const directUrl = await getDirectDownloadUrl(url, format as 'video' | 'audio');

    if (!directUrl) {
      return NextResponse.json(
        {
          error: 'Could not get a direct download URL for this video. It may be restricted, age-gated, or use a format we cannot access.',
          code: 'NO_DIRECT_URL',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      url: directUrl,
      format: format,
      // Note: the actual file extension depends on what the CDN serves.
      // Audio streams from YouTube are typically .m4a or .webm.
      // We cannot convert to MP3 on Vercel without ffmpeg.
      filename: `download.${format === 'audio' ? 'm4a' : 'mp4'}`,
    });
  } catch (error: any) {
    console.error('Download API unexpected error:', {
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
