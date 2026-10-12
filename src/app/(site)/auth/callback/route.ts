import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Landing point for OAuth redirects, magic links and password-reset links.
 * Exchanges the one-time code for a session cookie, then forwards on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';

  if (!code) {
    return NextResponse.redirect(`${origin}/account/sign-in?error=link`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/account/sign-in?error=unavailable`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Expired or already-used link.
    return NextResponse.redirect(`${origin}/account/sign-in?error=link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
