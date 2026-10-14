/**
 * High-performance, low-latency analytics utilities for Linktree profile pages.
 */

// Memory throttle cache to prevent spamming database view counts on refresh storms
const viewThrottleCache = new Map<string, number>();
const THROTTLE_TTL_MS = 5 * 60 * 1000; // 5 minutes window per IP + username

/**
 * Checks and records a throttle hit for a given IP + username.
 * Returns true if the event is fresh and should be recorded in DB.
 * Returns false if the visit occurred within the cooldown window.
 */
export function shouldRecordView(ip: string, username: string): boolean {
  const key = `${ip}:${username.toLowerCase()}`;
  const now = Date.now();
  const lastSeen = viewThrottleCache.get(key);

  if (lastSeen && now - lastSeen < THROTTLE_TTL_MS) {
    return false;
  }

  viewThrottleCache.set(key, now);

  // Periodic cleanup if cache grows
  if (viewThrottleCache.size > 10000) {
    for (const [k, timestamp] of viewThrottleCache.entries()) {
      if (now - timestamp > THROTTLE_TTL_MS) {
        viewThrottleCache.delete(k);
      }
    }
  }

  return true;
}

/**
 * Validates and normalizes target redirection URLs to prevent open-redirect vulnerabilities.
 */
export function sanitizeRedirectUrl(targetUrl: string | null | undefined): string | null {
  if (!targetUrl) return null;
  const trimmed = targetUrl.trim();

  // Block javascript: or data: schemes
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  // Allow mailto:
  if (/^mailto:/i.test(trimmed)) {
    return trimmed;
  }

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
