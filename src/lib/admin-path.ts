/**
 * The admin console's public URL.
 *
 * The real routes live at /console (route group `(admin)`), which proxy.ts
 * blocks from direct access. The only way in is the secret path held in
 * ADMIN_PATH_SECRET — set it in .env.local and in Vercel, never in git, never
 * in a nav link, never in sitemap.xml.
 *
 * Obscurity is the outer layer only. Every admin page also calls
 * requireAdmin(), which is the check that actually protects anything.
 */

/** Where the admin routes really live. */
export const ADMIN_ROUTE_ROOT = '/console';

/** Falls back to something unguessable-but-stable so local dev works unset. */
export const ADMIN_PATH_SECRET = (process.env.ADMIN_PATH_SECRET || 'ops-console-dev').replace(
  /^\/+|\/+$/g,
  '',
);

export const ADMIN_PATH = `/${ADMIN_PATH_SECRET}`;

/** Builds a link inside the admin console, e.g. adminHref('/users'). */
export function adminHref(subpath = ''): string {
  const clean = subpath.replace(/^\/+/, '');
  return clean ? `${ADMIN_PATH}/${clean}` : ADMIN_PATH;
}
