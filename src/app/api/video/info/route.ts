import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl, checkRateLimit, sanitizeLogInput } from '@/lib/video-security';
import { getVideoInfo } from '@/lib/video-downloader';

/**
 * POST /api/video/info
 *
 * Securely fetches video metadata for a given URL.
 *
 * Security measures:
 * - Rate limiting per IP
 * - Strict URL allowlist (YouTube, Facebook, Instagram, X)
 * - Input length limits
 * - Error sanitization (no internal details leaked)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again in a minute.' },
        { status: 429 }
      );
    }

    // Parse and validate body
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with a "url" field.' },
        { status: 400 }
      );
    }

    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required and must be a string.' },
        { status: 400 }
      );
    }

    if (url.length > 2048) {
      return NextResponse.json(
        { error: 'URL exceeds maximum length.' },
        { status: 400 }
      );
    }

    // Strict URL validation
    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported URL. Only YouTube, Facebook, Instagram, and X (Twitter) URLs are allowed.' },
        { status: 400 }
      );
    }

    // Fetch video info securely through the wrapper
    const info = await getVideoInfo(url);

    return NextResponse.json({ success: true, data: info }, { status: 200 });
  } catch (error: any) {
    console.error('Video info API error:', sanitizeLogInput(error?.message || 'Unknown error'));

    // Return sanitized error - never expose internal details
    const message = error?.message || 'Failed to process request.';

    if (message.includes('Invalid or unsupported URL')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message.includes('private') || message.includes('age-restricted') || message.includes('authentication')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes('not available') || message.includes('removed') || message.includes('blocked')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch video information. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * Reject GET requests to prevent accidental URL logging in server access logs.
 * (URLs in query strings end up in logs, which is a security concern.)
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with a JSON body.' },
    { status: 405 }
  );
}
