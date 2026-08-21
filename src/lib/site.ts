/**
 * Absolute site URL, needed for OAuth and email-link redirects.
 *
 * Order: explicit config, then the Vercel-provided URL, then localhost.
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production host; VERCEL_URL is
 * the per-deployment one, which is right for preview builds.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;

  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const SITE_NAME = 'ConvertTools';
