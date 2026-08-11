import { NextRequest, NextResponse } from 'next/server';
import {
  FetchError,
  MAX_ASSET_BYTES,
  parseTargetUrl,
  readCapped,
  safeFetch,
} from '@/lib/web-fetch';
import { rewriteCss } from '@/lib/html-prepare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_TYPES = /^(image\/|font\/|text\/css|application\/font|application\/x-font|application\/vnd\.ms-fontobject)/i;

/**
 * GET /api/html/asset?u=<absolute url>
 *
 * Same-origin proxy for the images, fonts and stylesheets a captured page
 * needs. Stylesheets are rewritten on the way through so the resources they
 * reference come back through here too.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('u');
    if (!raw) return NextResponse.json({ error: 'Missing asset URL.' }, { status: 400 });

    const target = parseTargetUrl(raw);
    const { response, finalUrl } = await safeFetch(target, '*/*');

    if (!response.ok) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    }

    const contentType = (response.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim();
    if (!ALLOWED_TYPES.test(contentType)) {
      // Anything else (HTML, JS, JSON…) has no business being pulled into the render.
      return new NextResponse(null, { status: 415 });
    }

    const bytes = await readCapped(response, MAX_ASSET_BYTES);

    if (/^text\/css/i.test(contentType)) {
      const css = rewriteCss(new TextDecoder('utf-8').decode(bytes), finalUrl.toString());
      return new NextResponse(css, {
        status: 200,
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'cache-control': 'public, max-age=600',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    return new NextResponse(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
        'cache-control': 'public, max-age=600',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof FetchError) {
      return new NextResponse(null, { status: err.status });
    }
    return new NextResponse(null, { status: 500 });
  }
}
