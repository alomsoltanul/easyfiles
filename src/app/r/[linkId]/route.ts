import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sanitizeRedirectUrl } from '@/lib/profile-links/analytics';
import { getSiteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ linkId: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * High-speed redirect endpoint for profile links: /r/[linkId]
 * Atomically increments the click counter and issues an immediate HTTP 302 redirect.
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { linkId } = await params;
  const siteUrl = getSiteUrl();

  // Guard against malformed IDs
  if (!linkId || !UUID_REGEX.test(linkId)) {
    return NextResponse.redirect(siteUrl, { status: 302 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    // 1. Atomically increment click count and retrieve destination URL in single query
    const { data: rawUrl, error } = await supabase.rpc('increment_link_clicks', {
      p_link_id: linkId,
    });

    if (error || !rawUrl) {
      // Fallback: If RPC fails, try reading directly without counter
      const { data: linkRow } = await supabase
        .from('profile_links')
        .select('url')
        .eq('id', linkId)
        .maybeSingle();

      const fallbackUrl = sanitizeRedirectUrl(linkRow?.url);
      if (fallbackUrl) {
        return NextResponse.redirect(fallbackUrl, {
          status: 302,
          headers: { 'Cache-Control': 'no-store, must-revalidate' },
        });
      }
      return NextResponse.redirect(siteUrl, { status: 302 });
    }

    const safeUrl = sanitizeRedirectUrl(rawUrl);
    if (!safeUrl) {
      return NextResponse.redirect(siteUrl, { status: 302 });
    }

    return NextResponse.redirect(safeUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch {
    return NextResponse.redirect(siteUrl, { status: 302 });
  }
}
