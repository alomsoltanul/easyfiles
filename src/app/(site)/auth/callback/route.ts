import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env';
import { getSiteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Landing point for OAuth redirects, magic links, email confirmations,
 * and password-reset links.
 * Handles PKCE codes, OTP token_hashes, and client-side hash fragments.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const siteUrl = getSiteUrl();

  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  // If Supabase returned an explicit error (e.g. otp_expired)
  if (errorParam) {
    const errorUrl = new URL('/account/sign-in', siteUrl);
    errorUrl.searchParams.set('error', 'link');
    errorUrl.searchParams.set('message', errorParam);
    return NextResponse.redirect(errorUrl);
  }

  // Determine destination path
  let next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
  if (type === 'recovery') {
    next = '/account/reset';
  }

  const destinationUrl = new URL(next, siteUrl);

  // If neither code nor token_hash is in searchParams, the user might have client-side hash tokens
  // (#access_token=...) from an implicit-flow email template!
  if (!code && !token_hash) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authenticating...</title></head>
<body>
<script>
  if (window.location.hash && window.location.hash.includes('access_token')) {
    var target = ${JSON.stringify(next)};
    if (window.location.hash.includes('type=recovery')) {
      target = '/account/reset';
    }
    window.location.replace(target + window.location.hash);
  } else {
    window.location.replace('/account/sign-in?error=link');
  }
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#64748b;">Completing sign in...</p>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Create redirect response so cookies can be set directly on it
  const response = NextResponse.redirect(destinationUrl);

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let authError: Error | null = null;

  if (token_hash && type) {
    const res = await supabase.auth.verifyOtp({ token_hash, type });
    if (res.error) authError = res.error;
  } else if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    if (res.error) authError = res.error;
  }

  if (authError) {
    const errorUrl = new URL('/account/sign-in', siteUrl);
    errorUrl.searchParams.set('error', 'link');
    errorUrl.searchParams.set('message', authError.message);
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
