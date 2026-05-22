/**
 * Video Downloader Security Utilities
 *
 * Comprehensive security layer to prevent:
 * - Command injection
 * - SSRF (Server-Side Request Forgery)
 * - Abuse via malicious URLs
 * - Rate limiting bypass
 */

// Allowed platforms - strictly limited to prevent abuse
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
  'music.youtube.com',
  'facebook.com',
  'www.facebook.com',
  'fb.watch',
  'm.facebook.com',
  'instagram.com',
  'www.instagram.com',
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
  'instagram.com',
  'twitter.com',
  'x.com',
]);

// Known safe subdomains
const KNOWN_SUBDOMAINS = ['www.', 'm.', 'music.', 'mobile.'];

/**
 * Validates that a URL is from an allowed video platform.
 * Rejects malformed URLs, IP addresses, non-HTTP protocols, embedded credentials,
 * unusual ports, and any domain not in the explicit allowlist.
 */
export function isAllowedUrl(inputUrl: string): boolean {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return false;
  }

  // Trim whitespace and normalize
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

    // Reject URLs containing shell metacharacters or control characters in any part
    if (containsDangerousCharacters(trimmed)) {
      return false;
    }

    // Reject if hostname doesn't match allowlist
    if (!ALLOWED_HOSTS.has(hostname)) {
      return false;
    }

    // Double-check: extract base domain and verify it's truly allowed
    const baseDomain = getBaseDomain(hostname);
    if (!BASE_ALLOWED_DOMAINS.has(baseDomain)) {
      return false;
    }

    // Reject URLs with unusual path characters that might be used for traversal or injection
    if (containsPathTraversal(url.pathname)) {
      return false;
    }

    // Reject URLs with query strings containing suspicious patterns
    if (containsSuspiciousQuery(url.search)) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL syntax
    return false;
  }
}

/**
 * Checks if a hostname is an IP address (IPv4 or IPv6).
 */
function isIPAddress(hostname: string): boolean {
  // IPv4 check
  const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    return true;
  }

  // IPv6 check (simplified - checks for hex digits and colons, enclosed in brackets)
  const ipv6Pattern = /^\[?[0-9a-fA-F:]+\]?$/;
  if (ipv6Pattern.test(hostname) && hostname.includes(':')) {
    return true;
  }

  // Reject 'localhost' and common internal hostnames
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
 * Checks for dangerous shell/command characters that could be used for injection.
 */
function containsDangerousCharacters(input: string): boolean {
  // Shell metacharacters and control characters
  const dangerous = /[;|`$&{}()<>\n\r\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f]/;
  return dangerous.test(input);
}

/**
 * Checks for path traversal patterns.
 */
function containsPathTraversal(pathname: string): boolean {
  return pathname.includes('..') || pathname.includes('%2e%2e') || pathname.includes('.%2e') || pathname.includes('%2e.');
}

/**
 * Checks for suspicious query parameters that might indicate injection attempts.
 */
function containsSuspiciousQuery(search: string): boolean {
  if (!search || search.length === 0) return false;
  const lower = search.toLowerCase();
  const suspicious = ['cmd=', 'exec=', 'eval=', 'system=', 'shell=', 'bash=', 'sh=', 'python=', 'node=', 'php=', 'perl='];
  return suspicious.some((s) => lower.includes(s));
}

// ===== Rate Limiting =====

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15; // 15 requests per minute per IP

/**
 * Simple in-memory rate limiter.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
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

// Cleanup every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

// ===== Input Sanitization =====

/**
 * Sanitizes a string to prevent injection in logs or error messages.
 * Removes control characters and limits length.
 */
export function sanitizeLogInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    .slice(0, 500);
}

/**
 * Detects the platform from a URL for UI display purposes.
 */
export function detectPlatform(url: string): 'youtube' | 'facebook' | 'instagram' | 'twitter' | 'unknown' {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('facebook') || hostname.includes('fb.watch')) return 'facebook';
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
  return name
    .replace(/[<>|:*?"\\/\x00-\x1f]/g, '_')
    .replace(/\.+/g, '.')
    .trim()
    .slice(0, 100);
}

/**
 * Validates the requested format is valid.
 */
export function isValidFormat(format: string): format is 'video' | 'audio' {
  return format === 'video' || format === 'audio';
}

/**
 * Validates the requested quality is valid.
 */
export function isValidQuality(quality: string): boolean {
  const validQualities = ['best', '1080p', '720p', '480p', '360p', 'audio'];
  return validQualities.includes(quality);
}
