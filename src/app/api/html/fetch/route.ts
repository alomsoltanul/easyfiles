import { NextRequest, NextResponse } from 'next/server';
import {
  FetchError,
  MAX_HTML_BYTES,
  parseTargetUrl,
  readCapped,
  safeFetch,
} from '@/lib/web-fetch';
import { preparePage } from '@/lib/html-prepare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/html/fetch
 *
 * Fetches a public web page and returns it sanitised, with every sub-resource
 * pointed at /api/html/asset. The browser then renders that markup in a
 * sandboxed same-origin iframe and rasterises it into a PDF — no headless
 * browser on the server, and no cross-origin canvas tainting on the client.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const target = parseTargetUrl(body.url ?? '');
    const { response, finalUrl } = await safeFetch(
      target,
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `That page returned HTTP ${response.status}.` },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return NextResponse.json(
        { error: `That address returned ${contentType.split(';')[0] || 'an unknown type'}, not a web page.` },
        { status: 415 }
      );
    }

    const bytes = await readCapped(response, MAX_HTML_BYTES);
    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
    let raw: string;
    try {
      raw = new TextDecoder(charset).decode(bytes);
    } catch {
      raw = new TextDecoder('utf-8').decode(bytes);
    }

    const prepared = preparePage(raw, finalUrl.toString());

    return NextResponse.json({
      html: prepared.html,
      title: prepared.title,
      assets: prepared.assets,
      finalUrl: finalUrl.toString(),
      bytes: bytes.byteLength,
    });
  } catch (err) {
    if (err instanceof FetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'That page could not be loaded.' }, { status: 500 });
  }
}
