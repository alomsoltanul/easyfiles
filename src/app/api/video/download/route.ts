import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl, normalizeUrl, checkRateLimit, isValidFormat, isValidQuality, type Quality } from '@/lib/video-security';
import { invalidateVideoInfo, resolveDownload, resolveVerifiedDownload, VideoError } from '@/lib/video-downloader';
import { streamDownload } from '@/lib/video-stream';
import { verifyDownloadToken } from '@/lib/video-token';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface DownloadRequest {
  url: string;
  format: 'video' | 'audio';
  quality: Quality;
  audioFormat: 'original' | 'mp3';
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof VideoError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error('Video download API error:', {
    message: (error as Error)?.message,
    stack: (error as Error)?.stack?.split('\n').slice(0, 5),
  });

  return NextResponse.json({ error: 'Download failed. Please try again.', code: 'UNKNOWN' }, { status: 500 });
}

async function handle(request: NextRequest, params: DownloadRequest): Promise<Response> {
  const options = {
    format: params.format,
    quality: params.quality,
    audioFormat: params.audioFormat,
  };

  try {
    const resolved = await resolveDownload(params.url, options);
    return await streamDownload(resolved, request);
  } catch (error) {
    if (error instanceof VideoError && error.code === 'UPSTREAM_FAILED') {
      invalidateVideoInfo(params.url);
      const fresh = await resolveDownload(params.url, { ...options, skipCache: true });
      return await streamDownload(fresh, request);
    }
    throw error;
  }
}

function rateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return !checkRateLimit(`${ip}:download`, 12);
}

/**
 * GET /api/video/download?t=<signed token>
 *
 * The browser navigates here directly so the file streams to disk through the
 * native download manager. The token is minted by /api/video/prepare, which
 * keeps source URLs out of query strings and access logs.
 */
export async function GET(request: NextRequest) {
  try {
    if (rateLimited(request)) {
      return NextResponse.json({ error: 'Too many downloads. Please wait a minute.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const token = request.nextUrl.searchParams.get('t');
    if (!token) {
      return NextResponse.json({ error: 'Missing download token.', code: 'TOKEN_MISSING' }, { status: 400 });
    }

    const claims = verifyDownloadToken(token);
    if (!claims) {
      return NextResponse.json(
        { error: 'This download link has expired. Fetch the video again to get a fresh one.', code: 'TOKEN_INVALID' },
        { status: 403 },
      );
    }

    if (!isAllowedUrl(claims.url) || !isValidFormat(claims.format) || !isValidQuality(claims.quality)) {
      return NextResponse.json({ error: 'Invalid download request.', code: 'CLAIMS_INVALID' }, { status: 400 });
    }

    // Probe: resolve and verify upstream stream(s) before handing the request to
    // the browser's download manager, refreshing stale cached CDN links if needed.
    if (request.nextUrl.searchParams.get('probe') === '1') {
      const { resolved, size } = await resolveVerifiedDownload(claims.url, {
        format: claims.format,
        quality: claims.quality,
        audioFormat: claims.audioFormat,
      });

      return NextResponse.json({
        success: true,
        mode: resolved.mode,
        fileName: resolved.fileName,
        size,
      });
    }

    return await handle(request, claims);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/video/download
 *
 * Same streaming behaviour, for callers that prefer a body over a token
 * (programmatic use, or a browser without a working navigation download).
 */
export async function POST(request: NextRequest) {
  try {
    if (rateLimited(request)) {
      return NextResponse.json({ error: 'Too many downloads. Please wait a minute.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.', code: 'INVALID_BODY' }, { status: 400 });
    }

    const rawUrl = typeof body.url === 'string' ? body.url : '';
    const format = typeof body.format === 'string' ? body.format : '';
    const quality = typeof body.quality === 'string' ? body.quality : 'best';
    const audioFormat = body.audioFormat === 'mp3' ? 'mp3' : 'original';

    if (!rawUrl || rawUrl.length > 2048) {
      return NextResponse.json({ error: 'A video URL is required.', code: 'MISSING_URL' }, { status: 400 });
    }
    if (!isValidFormat(format)) {
      return NextResponse.json({ error: 'Format must be "video" or "audio".', code: 'FORMAT_INVALID' }, { status: 400 });
    }
    if (!isValidQuality(quality)) {
      return NextResponse.json({ error: 'Unsupported quality option.', code: 'QUALITY_INVALID' }, { status: 400 });
    }

    const url = normalizeUrl(rawUrl);
    if (!isAllowedUrl(url)) {
      return NextResponse.json({ error: 'That link is not supported.', code: 'URL_INVALID' }, { status: 400 });
    }

    return await handle(request, { url, format, quality, audioFormat });
  } catch (error) {
    return errorResponse(error);
  }
}
