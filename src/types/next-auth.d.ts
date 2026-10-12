/**
 * Shape of the admin session, added to NextAuth's own types.
 *
 * `adminId` is a public.admin_users row id — deliberately not a customer id.
 * Nothing here is trusted for authorisation on its own; requireAdminSession()
 * re-reads the row before any page renders.
 */

import type { AdminRole } from '@/lib/supabase/database.types';

declare module 'next-auth' {
  interface Session {
    user: {
      adminId?: string;
      role?: AdminRole;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    adminId?: string;
    adminRole?: AdminRole;
  }
}

export {};
