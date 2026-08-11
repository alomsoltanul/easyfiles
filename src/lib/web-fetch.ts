import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Server-side guards for the HTML → PDF fetcher.
 *
 * The tool takes an arbitrary URL from the user, so every request has to be
 * treated as a possible SSRF probe: only plain http(s) on standard ports, no
 * embedded credentials, and the resolved address must be publicly routable.
 */

export const MAX_HTML_BYTES = 8 * 1024 * 1024;
export const MAX_ASSET_BYTES = 12 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export class FetchError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'FetchError';
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;            // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;  // carrier-grade NAT
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true;                          // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique local
  if (value.startsWith('fe80')) return true;                          // link-local
  if (value.startsWith('::ffff:')) return isPrivateIPv4(value.slice(7));
  return false;
}

export function parseTargetUrl(raw: string): URL {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) throw new FetchError('Enter a web address to convert.');
  if (trimmed.length > 2048) throw new FetchError('That URL is too long.');

  // Reject a non-web scheme up front. Without this, "file:///etc/passwd" would
  // be treated as a bare host and silently rewritten to https://file/...
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    throw new FetchError('Only http:// and https:// addresses can be converted.');
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new FetchError('That does not look like a valid web address.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchError('Only http:// and https:// addresses can be converted.');
  }
  if (url.username || url.password) {
    throw new FetchError('URLs with embedded credentials are not allowed.');
  }
  if (url.port && !['', '80', '443', '8080', '8443'].includes(url.port)) {
    throw new FetchError('Only standard web ports are allowed.');
  }
  return url;
}

/** Reject hostnames that resolve to anything inside the private network. */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) {
    throw new FetchError('That address points at a private host.', 403);
  }

  const literal = isIP(host);
  if (literal === 4 && isPrivateIPv4(host)) throw new FetchError('That address points at a private host.', 403);
  if (literal === 6 && isPrivateIPv6(host)) throw new FetchError('That address points at a private host.', 403);
  if (literal) return;

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new FetchError('That domain could not be resolved.', 502);
  }
  if (addresses.length === 0) throw new FetchError('That domain could not be resolved.', 502);

  for (const entry of addresses) {
    const bad = entry.family === 4 ? isPrivateIPv4(entry.address) : isPrivateIPv6(entry.address);
    if (bad) throw new FetchError('That address points at a private host.', 403);
  }
}

export interface SafeFetchResult {
  response: Response;
  finalUrl: URL;
}

/** Fetch with a timeout, a browser user agent, and a re-check after redirects. */
export async function safeFetch(url: URL, accept: string): Promise<SafeFetchResult> {
  await assertPublicHost(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': BROWSER_UA,
        accept,
        'accept-language': 'en-US,en;q=0.9',
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchError('That page took too long to respond.', 504);
    }
    throw new FetchError('That page could not be reached.', 502);
  }
  clearTimeout(timer);

  const finalUrl = parseTargetUrl(response.url || url.toString());
  if (finalUrl.hostname !== url.hostname) {
    // A redirect moved us somewhere else — validate the new destination too.
    await assertPublicHost(finalUrl);
  }

  return { response, finalUrl };
}

/** Read a body with a hard size ceiling so a huge file cannot exhaust memory. */
export async function readCapped(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > limit) throw new FetchError('That file is too large to convert.', 413);

  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new FetchError('That file is too large to convert.', 413);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
