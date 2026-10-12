import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { AdminRole } from '../supabase/database.types';
import { ADMIN_LOGIN_PATH, ADMIN_PATH } from './path';
import { checkLoginThrottle, clientIp, recordLoginAttempt } from './rate-limit';
import {
  bindGoogleIdentity,
  findAdminByEmail,
  normalizeEmail,
  recordSuccessfulLogin,
  verifyPassword,
} from './users';

/**
 * NextAuth for the admin console — a second, independent authentication system
 * that shares nothing with customer sign-in.
 *
 *   customers  Supabase Auth  ->  auth.users + profiles  ->  sb-* cookies
 *   admins     NextAuth       ->  public.admin_users     ->  ct-admin.session
 *
 * Neither can produce a session the other recognises. A customer cannot become
 * an admin, and an admin has no plan, no quota and no tool history.
 *
 * Sessions are JWTs, so a page render costs no session lookup — but the token
 * alone is never trusted for authorisation: requireAdminSession() re-reads the
 * admin_users row on every request so disabling an account takes effect on the
 * next click rather than in eight hours.
 */

/** Only the two outcomes the login form is allowed to tell apart. */
export type AdminSignInCode = 'invalid' | 'throttled';

class AdminSignInError extends CredentialsSignin {
  constructor(code: AdminSignInCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Google is optional. Registering the provider without credentials would make
 * every sign-in attempt fail with a configuration error, so it is only added
 * when both variables are present, and the login page hides the button.
 */
export const GOOGLE_ENABLED = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const isProduction = process.env.NODE_ENV === 'production';

/**
 * A distinct cookie name keeps the admin session clearly separate from the
 * Supabase customer cookies in devtools, in logs and in any future clean-up.
 */
const SESSION_COOKIE = isProduction ? '__Secure-ct-admin.session' : 'ct-admin.session';

const config: NextAuthConfig = {
  trustHost: true,
  // Eight hours: long enough for a working day, short enough that a forgotten
  // session on a shared machine expires the same day.
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },

  pages: {
    signIn: ADMIN_LOGIN_PATH,
    signOut: ADMIN_LOGIN_PATH,
    /*
     * Public on purpose. Auth.js answers a failed OAuth callback with a
     * redirect to this address, and /api/auth/callback/google has to stay
     * reachable for the round trip — so pointing it at the console's login
     * screen would hand the secret path to anyone who sent one unauthenticated
     * request. Credentials failures never reach here: they are caught inside
     * the sign-in Server Action and rendered on the form.
     */
    error: '/sign-in-failed',
  },

  cookies: {
    sessionToken: {
      name: SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        // Not scoped to the secret path: the OAuth callback lands on /api/auth,
        // which a path-scoped cookie would never be sent to.
        path: '/',
        secure: isProduction,
      },
    },
  },

  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const email = normalizeEmail(String(raw?.email ?? ''));
        const password = String(raw?.password ?? '');
        if (!email || !password) throw new AdminSignInError('invalid');

        // Read from the request rather than the form: this same code path is
        // reachable by POSTing the callback URL directly, and a client-supplied
        // address would make the per-IP counter meaningless.
        const ip = await clientIp();

        const throttle = await checkLoginThrottle(email, ip);
        if (!throttle.allowed) {
          await recordLoginAttempt(email, ip, false, 'throttled');
          throw new AdminSignInError('throttled');
        }

        const user = await findAdminByEmail(email);

        // Always runs, even for an unknown email: verifyPassword() compares
        // against a dummy hash when there is nothing to compare against, so the
        // response takes the same time either way.
        const passwordOk = await verifyPassword(user?.password_hash ?? null, password);

        // Unknown email, disabled account, Google-only account and wrong
        // password all fail the same way. Telling them apart would confirm to a
        // stranger which addresses have console access. The distinction is kept
        // in the attempt log, where only an admin can read it.
        if (!user || user.disabled_at || !passwordOk) {
          const reason = !user
            ? 'unknown_email'
            : user.disabled_at
              ? 'disabled'
              : user.password_hash
                ? 'bad_password'
                : 'no_password';
          await recordLoginAttempt(email, ip, false, reason);
          throw new AdminSignInError('invalid');
        }

        await Promise.all([recordLoginAttempt(email, ip, true), recordSuccessfulLogin(user.id)]);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image_url,
        };
      },
    }),

    ...(GOOGLE_ENABLED
      ? [
          Google({
            // Console accounts are created by an owner, never by signing in, so
            // the account must already exist before Google is any use.
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * The gate for Google. Credentials have already been checked in authorize()
     * by the time this runs, so only the OAuth path does real work here.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;

      const email = normalizeEmail(profile?.email ?? user.email ?? '');
      const ip = await clientIp();

      if (!email || profile?.email_verified === false) {
        await recordLoginAttempt(email || 'unknown', ip, false, 'google_unverified');
        return false;
      }

      const throttle = await checkLoginThrottle(email, ip);
      if (!throttle.allowed) {
        await recordLoginAttempt(email, ip, false, 'throttled');
        return false;
      }

      const admin = await findAdminByEmail(email);
      if (!admin || admin.disabled_at) {
        await recordLoginAttempt(email, ip, false, admin ? 'disabled' : 'unknown_email');
        return false;
      }

      const sub = String(account.providerAccountId ?? profile?.sub ?? '');
      const bound = await bindGoogleIdentity(admin, sub, {
        name: profile?.name ?? user.name,
        image: profile?.picture ?? user.image,
      });
      if (!bound) {
        // The email matches an admin but Google reports a different subject —
        // an address that changed hands, or something worse. Refuse and leave
        // it for a human.
        await recordLoginAttempt(email, ip, false, 'google_sub_mismatch');
        return false;
      }

      await Promise.all([recordLoginAttempt(email, ip, true), recordSuccessfulLogin(admin.id)]);
      return true;
    },

    /**
     * Puts the admin row's id and role on the token. Google gives us an OAuth
     * subject rather than our own id, so the row is looked up by email on the
     * sign-in pass; afterwards the token carries everything.
     */
    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        const admin = await findAdminByEmail(normalizeEmail(token.email ?? user?.email ?? ''));
        if (!admin) return token;
        token.adminId = admin.id;
        token.adminRole = admin.role;
        token.name = admin.name ?? token.name;
        token.picture = admin.image_url ?? token.picture;
        return token;
      }

      if (user?.id) {
        token.adminId = user.id;
        // Read once at sign-in; requireAdminSession() re-reads the live row on
        // every request, so a role change never waits for the token to expire.
        const admin = await findAdminByEmail(normalizeEmail(user.email ?? ''));
        token.adminRole = admin?.role ?? 'viewer';
      }
      return token;
    },

    async session({ session, token }) {
      if (token.adminId) session.user.adminId = token.adminId as string;
      if (token.adminRole) session.user.role = token.adminRole as AdminRole;
      return session;
    },

    /** Never let a callbackUrl bounce the browser off the console. */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}${ADMIN_PATH}`;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
