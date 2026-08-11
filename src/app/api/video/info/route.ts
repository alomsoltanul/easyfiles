import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl, normalizeUrl, checkRateLimit } from '@/lib/video-security';
import { getVideoInfo, VideoError } from '@/lib/video-downloader';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/video/info
 *
 * Returns display metadata plus the quality rungs that are actually
 * downloadable for this video. Source CDN URLs are deliberately not returned:
 * they are IP-locked to this server and are only used by /api/video/download.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(`${ip}:info`)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again in a minute.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.', code: 'INVALID_BODY' }, { status: 400 });
    }

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'A video URL is required.', code: 'MISSING_URL' }, { status: 400 });
    }
    if (body.url.length > 2048) {
      return NextResponse.json({ error: 'That URL is too long.', code: 'URL_LENGTH' }, { status: 400 });
    }

    const url = normalizeUrl(body.url);

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        {
          error: 'That link is not supported. Paste a YouTube, Facebook, Instagram, or X (Twitter) video URL.',
          code: 'URL_INVALID',
        },
        { status: 400 },
      );
    }

    const info = await getVideoInfo(url);

    if (info.isLive) {
      return NextResponse.json(
        { error: 'Live streams cannot be downloaded. Try again once the stream has ended.', code: 'IS_LIVE' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        webpageUrl: info.webpageUrl,
        platform: info.platform,
        qualities: info.qualities,
        hasAudioOnly: info.hasAudioOnly,
        canConvertMp3: info.canConvertMp3,
      },
    });
  } catch (error) {
    if (error instanceof VideoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error('Video info API error:', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack?.split('\n').slice(0, 5),
    });

    return NextResponse.json(
      { error: 'Could not read that video. Please try again.', code: 'UNKNOWN' },
      { status: 500 },
    );
  }
}

/** GET is rejected so video URLs never end up in access logs. */
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.', code: 'METHOD' }, { status: 405 });
}
