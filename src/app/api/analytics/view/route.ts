import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { shouldRecordView } from '@/lib/profile-links/analytics';
import { isReservedUsername } from '@/lib/profile-links/constants';

export const dynamic = 'force-dynamic';

/**
 * Endpoint for receiving non-blocking page view beacons from user profile pages.
 * Implements IP-based sliding window throttling to prevent database lock contention.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';

    if (!username || isReservedUsername(username)) {
      return new Response(null, { status: 204 });
    }

    // Determine visitor IP for deduplication
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = (forwardedFor ? forwardedFor.split(',')[0].trim() : realIp) || '127.0.0.1';

    // Check 5-minute sliding window cooldown
    if (!shouldRecordView(ip, username)) {
      // Throttled: Visitor viewed page recently, ignore duplicate write
      return new Response(null, { status: 204 });
    }

    // Record view atomically via Supabase RPC
    const supabase = getSupabaseAdminClient();
    await supabase.rpc('increment_profile_views', { p_username: username });

    return new Response(null, { status: 204 });
  } catch {
    // Analytics endpoints should fail silently without returning 500s to clients
    return new Response(null, { status: 204 });
  }
}
