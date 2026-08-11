import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl, normalizeUrl, checkRateLimit, isValidFormat, isValidQuality } from '@/lib/video-security';
import { signDownloadToken } from '@/lib/video-token';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/video/prepare
 *
 * Mints a short-lived signed token describing what to download. The browser
 * then navigates to /api/video/download?t=<token>, which gives a native
 * streaming download instead of buffering the file in page memory.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(`${ip}:prepare`)) {
    return NextResponse.json(
      { error: 'Too many download requests. Please wait a minute and try again.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
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
    return NextResponse.json(
      { error: 'That link is not supported. Paste a YouTube, Facebook, Instagram, or X (Twitter) video URL.', code: 'URL_INVALID' },
      { status: 400 },
    );
  }

  const token = signDownloadToken({ url, format, quality, audioFormat });

  return NextResponse.json({ success: true, token, downloadUrl: `/api/video/download?t=${encodeURIComponent(token)}` });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.', code: 'METHOD' }, { status: 405 });
}
