/**
 * Video Downloader Security Utilities
 *
 * Security layer to prevent:
 * - Command injection (yt-dlp is always spawned with an argv array, never a shell)
 * - SSRF (Server-Side Request Forgery)
 * - Abuse via malicious URLs
 * - Rate limiting bypass
 */

export type Platform = 'youtube' | 'facebook' | 'instagram' | 'twitter';

// Allowed platforms - strictly limited to prevent abuse
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
  'music.youtube.com',
  'facebook.com',
  'www.facebook.com',
  'web.facebook.com',
  'fb.watch',
  'fb.gg',
  'm.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'ddinstagram.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'x.com',
  'www.x.com',
  'mobile.x.com',
]);

// Base domains for validation - must be exact match after removing known subdomains
const BASE_ALLOWED_DOMAINS = new Set([
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.watch',
  'fb.gg',
  'instagram.com',
  'ddinstagram.com',
  'twitter.com',
  'x.com',
]);

// Known safe subdomains
const KNOWN_SUBDOMAINS = ['www.', 'm.', 'music.', 'mobile.', 'web.'];

/**
 * Validates that a URL is from an allowed video platform.
 * Rejects malformed URLs, IP addresses, non-HTTP protocols, embedded credentials,
 * unusual ports, and any domain not in the explicit allowlist.
 */
export function isAllowedUrl(inputUrl: string): boolean {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return false;
  }

  const trimmed = inputUrl.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return false;
  }

  try {
    const url = new URL(trimmed);

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // Reject URLs with embedded credentials (user:pass@host)
    if (url.username || url.password) {
      return false;
    }

    // Reject unusual ports (only standard 80 and 443 allowed)
    if (url.port && url.port !== '80' && url.port !== '443') {
      return false;
    }

    const hostname = url.hostname.toLowerCase().trim();

    // Reject IP addresses entirely (prevents SSRF to internal services)
    if (isIPAddress(hostname)) {
      return false;
    }

    // Reject control characters. Shell metacharacters are NOT rejected: the URL is
    // passed to yt-dlp as an argv element (execFile, no shell), and characters like
    // "&" are legitimate in YouTube URLs (?v=ID&t=42s).
    if (containsControlCharacters(trimmed)) {
      return false;
    }

    if (!ALLOWED_HOSTS.has(hostname)) {
      return false;
    }

    // Double-check: extract base domain and verify it's truly allowed
    const baseDomain = getBaseDomain(hostname);
    if (!BASE_ALLOWED_DOMAINS.has(baseDomain)) {
      return false;
    }

    if (containsPathTraversal(url.pathname)) {
      return false;
    }

    // Reject anything that could be read as a yt-dlp option rather than a URL
    if (trimmed.startsWith('-')) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL syntax
    return false;
  }
}

/**
 * Normalizes a user-pasted URL: trims, adds a missing scheme, and strips
 * tracking/playlist parameters that confuse extractors.
 */
export function normalizeUrl(inputUrl: string): string {
  let candidate = (inputUrl || '').trim();
  if (!candidate) return '';

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();

    // YouTube: keep only the parameters that identify the video
    if (host.endsWith('youtube.com')) {
      const keep = new Set(['v', 't', 'start']);
      for (const key of [...url.searchParams.keys()]) {
        if (!keep.has(key)) url.searchParams.delete(key);
      }
    }
    if (host === 'youtu.be') {
      const keep = new Set(['t', 'start']);
      for (const key of [...url.searchParams.keys()]) {
        if (!keep.has(key)) url.searchParams.delete(key);
      }
    }
    // Instagram / Facebook / X: strip common tracking params
    for (const key of ['igsh', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'mibextid', 's', 'img_index']) {
      if (host.includes('instagram') || host.includes('facebook') || host.includes('fb.watch') || host.includes('twitter') || host.includes('x.com')) {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch {
    return candidate;
  }
}

/**
 * Checks if a hostname is an IP address (IPv4 or IPv6).
 */
function isIPAddress(hostname: string): boolean {
  const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    return true;
  }

  const ipv6Pattern = /^\[?[0-9a-fA-F:]+\]?$/;
  if (ipv6Pattern.test(hostname) && hostname.includes(':')) {
    return true;
  }

  const internalHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
  if (internalHosts.has(hostname)) {
    return true;
  }

  return false;
}

/**
 * Extracts the base domain by stripping known subdomains.
 */
function getBaseDomain(hostname: string): string {
  for (const prefix of KNOWN_SUBDOMAINS) {
    if (hostname.startsWith(prefix)) {
      return hostname.slice(prefix.length);
    }
  }
  return hostname;
}

/**
 * Rejects control characters (newlines, NULs) that could corrupt argv or headers.
 */
function containsControlCharacters(input: string): boolean {
  return /[\x00-\x1f\x7f]/.test(input);
}

/**
 * Checks for path traversal patterns.
 */
function containsPathTraversal(pathname: string): boolean {
  return pathname.includes('..') || pathname.includes('%2e%2e') || pathname.includes('.%2e') || pathname.includes('%2e.');
}

// ===== Rate Limiting =====

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // per IP per window

/**
 * Simple in-memory rate limiter.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(ip: string, max: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Cleanup old rate limit entries periodically.
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

// Cleanup every 5 minutes (unref'd so it never keeps a serverless instance alive)
if (typeof globalThis !== 'undefined') {
  const timer = setInterval(cleanupRateLimits, 5 * 60 * 1000);
  if (typeof timer === 'object' && typeof (timer as NodeJS.Timeout).unref === 'function') {
    (timer as NodeJS.Timeout).unref();
  }
}

// ===== Input Sanitization =====

/**
 * Sanitizes a string to prevent injection in logs or error messages.
 */
export function sanitizeLogInput(input: string): string {
  if (!input) return '';
  return input.replace(/[\x00-\x1f\x7f-\x9f]/g, '').slice(0, 500);
}

/**
 * Detects the platform from a URL for UI display purposes.
 */
export function detectPlatform(url: string): Platform | 'unknown' {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('facebook') || hostname.includes('fb.watch') || hostname.includes('fb.gg')) return 'facebook';
    if (hostname.includes('instagram')) return 'instagram';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Sanitizes a filename to prevent directory traversal or dangerous characters.
 */
export function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[<>|:*?"\\/\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/\.+/g, '.')
      .trim()
      .slice(0, 100) || 'download'
  );
}

/**
 * Builds an RFC 6266 / RFC 5987 compatible Content-Disposition value so that
 * non-ASCII titles survive the trip to the browser.
 */
export function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Validates the requested format is valid.
 */
export function isValidFormat(format: string): format is 'video' | 'audio' {
  return format === 'video' || format === 'audio';
}

export const VALID_QUALITIES = ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'] as const;
export type Quality = (typeof VALID_QUALITIES)[number];

/**
 * Validates the requested quality is valid.
 */
export function isValidQuality(quality: string): quality is Quality {
  return (VALID_QUALITIES as readonly string[]).includes(quality);
}
