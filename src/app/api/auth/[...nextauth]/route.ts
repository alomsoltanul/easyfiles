import { handlers } from '@/lib/admin/auth';

/**
 * NextAuth's own endpoints, for the admin console only.
 *
 * In practice the OAuth callback is the one that matters: sign-in and sign-out
 * both run in-process from Server Actions, and proxy.ts returns the site's 404
 * for /api/auth/signin, /api/auth/signout and /api/auth/error so that a stranger
 * poking at this path is never redirected to the console's secret address.
 */
export const { GET, POST } = handlers;
