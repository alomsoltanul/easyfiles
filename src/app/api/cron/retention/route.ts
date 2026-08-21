import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily history retention. Scheduled from vercel.ts; Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * The work itself is one SQL function so the whole prune is a single round
 * trip — see supabase/migrations/0004_retention.sql.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const { data, error } = await admin.rpc('prune_tool_history');
  if (error) {
    console.error('retention prune failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: data ?? 0 });
}
