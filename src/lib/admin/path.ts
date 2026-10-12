/**
 * Where the admin console lives, publicly and internally.
 *
 * The real routes are under /admin-console (route group `(admin)`), which
 * proxy.ts refuses to serve directly. The only way in is the secret path held
 * in ADMIN_PATH_SECRET — set it in .env.local and in Vercel, never in git,
 * never in a nav link, never in sitemap.xml.
 *
 * Obscurity is the outer layer only. Every page behind the login also calls
 * requireAdminSession(), which is the check that actually protects anything.
 *
 * ADMIN_PATH_SECRET is a server-only variable, so nothing in this module may be
 * imported from a Client Component — pass the path down as a prop instead.
 */

/** Where the admin routes really live. */
export const ADMIN_ROUTE_ROOT = '/admin-console';

/** Falls back to something unguessable-but-stable so local dev works unset. */
export const ADMIN_PATH_SECRET = (process.env.ADMIN_PATH_SECRET || 'ops-console-dev').replace(
  /^\/+|\/+$/g,
  '',
);

export const ADMIN_PATH = `/${ADMIN_PATH_SECRET}`;

/** Public URL of the login screen — NextAuth's `pages.signIn`. */
export const ADMIN_LOGIN_PATH = `${ADMIN_PATH}/login`;

/** Builds a link inside the admin console, e.g. adminHref('/users'). */
export function adminHref(subpath = ''): string {
  const clean = subpath.replace(/^\/+/, '');
  return clean ? `${ADMIN_PATH}/${clean}` : ADMIN_PATH;
}

/**
 * Maps a public admin URL onto the real route. Used by proxy.ts; kept here so
 * the two halves of the mapping cannot drift apart.
 */
export function toAdminRoute(pathname: string): string {
  return `${ADMIN_ROUTE_ROOT}${pathname.slice(ADMIN_PATH.length)}`;
}
