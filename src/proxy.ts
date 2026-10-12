/**
 * Next.js 16 renamed Middleware to Proxy. Same file position (next to `app`),
 * same matcher config, Node.js runtime by default — and `export const runtime`
 * is an error here, so don't add one.
 *
 * Three jobs:
 *   1. refresh the Supabase auth cookie on every page request (customers only —
 *      admins have their own NextAuth session and are not in Supabase at all)
 *   2. map the secret admin path onto the real /admin-console routes
 *   3. make guessable admin and login paths return the custom 404
 *
 * No authorisation happens here. The console's gate is requireAdminActor() in
 * the dashboard layout, which reads the admin_users row; keeping that DB read
 * out of proxy keeps every page request on the public site fast.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ADMIN_PATH, ADMIN_ROUTE_ROOT, toAdminRoute } from '@/lib/admin/path';

/**
 * Rewriting to a path with no route makes Next render app/not-found.tsx with a
 * real 404 status, which is exactly what we want for decoys.
 */
const NOT_FOUND_TARGET = '/__404__';

/**
 * Paths a prober tries first. Most of these would 404 on their own today; the
 * list makes that permanent, so adding a route later can never accidentally
 * expose one of them.
 */
const DECOY_PREFIXES = [
  '/login',
  '/log-in',
  '/signin',
  '/sign-in',
  '/admin',
  '/administrator',
  '/wp-admin',
  '/wp-login.php',
  '/cpanel',
  '/phpmyadmin',
  '/.env',
  '/.git',
  /*
   * NextAuth endpoints that answer with a redirect to the console login screen,
   * which would hand the secret path to anyone who asked for them.
   *
   * Nothing needs them. next-auth's signIn()/signOut() run the Auth handler
   * in-process from a Server Action rather than over HTTP, so blocking these
   * closes both the address leak and the only unauthenticated way to submit a
   * password. /api/auth/callback/google stays open — the OAuth round trip has
   * to come back somewhere.
   */
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/error',
  '/api/auth/callback/credentials',
];

function isDecoy(pathname: string): boolean {
  return DECOY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function notFound(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = NOT_FOUND_TARGET;
  url.search = '';
  return NextResponse.rewrite(url);
}

/** Decides the response, before session cookies are attached. */
function route(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Secret path -> real admin routes. /secret/users becomes
  // /admin-console/users.
  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = toAdminRoute(pathname);
    return NextResponse.rewrite(url);
  }

  // The real admin routes are never reachable at their own URL. Rewrites do not
  // re-enter proxy, so this only ever catches a direct hit from outside.
  if (pathname === ADMIN_ROUTE_ROOT || pathname.startsWith(`${ADMIN_ROUTE_ROOT}/`)) {
    return notFound(request);
  }

  if (isDecoy(pathname)) {
    return notFound(request);
  }

  return NextResponse.next({ request });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = route(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  // Touching auth.getUser() is what triggers the refresh; the rotated cookies
  // arrive through setAll and are copied onto whatever response we chose above.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // A refresh failure must not take the page down; the request continues
    // signed out and the free tools keep working.
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, static assets and the Stripe webhook.
     * The webhook authenticates with a signature, never a cookie — running the
     * session refresh on it would be pure latency on a retry-sensitive path.
     */
    '/((?!_next/static|_next/image|api/webhooks|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|mp4)$).*)',
  ],
};
