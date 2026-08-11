/**
 * Short-lived signed download tokens.
 *
 * The browser needs a plain GET link to trigger a native download (streaming
 * straight to disk instead of buffering the whole file in a blob). Putting the
 * raw source URL in that link would leak it into access logs and let anyone
 * use the endpoint as an open proxy, so the client first POSTs to /prepare and
 * receives an HMAC-signed payload that only this deployment can mint.
 */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type { Quality } from './video-security';

export interface DownloadClaims {
  url: string;
  format: 'video' | 'audio';
  quality: Quality;
  audioFormat: 'original' | 'mp3';
  exp: number;
}

const TOKEN_TTL_MS = 15 * 60 * 1000;

const SECRET_KEY = Symbol.for('convertools.video.tokenSecret');

function getSecret(): string {
  const configured = process.env.VIDEO_TOKEN_SECRET || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL;
  if (configured) return configured;

  // Local dev: keep one secret per process, surviving hot-reload of this module
  const store = globalThis as unknown as Record<symbol, string | undefined>;
  if (!store[SECRET_KEY]) store[SECRET_KEY] = randomBytes(32).toString('hex');
  return store[SECRET_KEY] as string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signDownloadToken(claims: Omit<DownloadClaims, 'exp'>): string {
  const payload: DownloadClaims = { ...claims, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyDownloadToken(token: string): DownloadClaims | null {
  if (!token || token.length > 4096) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DownloadClaims;
    if (!claims || typeof claims.url !== 'string') return null;
    if (typeof claims.exp !== 'number' || Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
