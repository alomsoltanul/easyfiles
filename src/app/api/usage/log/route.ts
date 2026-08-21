import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toolByHref } from '@/lib/tools';
import type { RunStatus } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

interface LogBody {
  slug?: string;
  fileCount?: number;
  inputBytes?: number;
  outputBytes?: number;
  durationMs?: number;
  status?: RunStatus;
  errorCode?: string | null;
}

function clampInt(value: unknown, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(n, 0), max);
}

/**
 * Records one tool run against the signed-in user's history and daily counter.
 *
 * Anonymous callers get a 204 and nothing is written — the tools themselves
 * still work, there is just no history to keep. The client fires this and
 * forgets, so a failure here must never surface as a tool error.
 */
export async function POST(request: NextRequest) {
  let body: LogBody;
  try {
    body = (await request.json()) as LogBody;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const tool = body.slug ? toolByHref(body.slug) : undefined;
  if (!tool) {
    // Unknown slug means a stale client or a forged call; drop it rather than
    // letting arbitrary strings into the history table.
    return NextResponse.json({ error: 'unknown tool' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse(null, { status: 204 });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new NextResponse(null, { status: 204 });

  const { error } = await supabase.rpc('record_tool_run', {
    p_tool_slug: tool.href,
    p_dept: tool.dept,
    p_label: tool.label,
    p_file_count: clampInt(body.fileCount ?? 1, 10_000),
    p_input_bytes: clampInt(body.inputBytes, Number.MAX_SAFE_INTEGER),
    p_output_bytes: clampInt(body.outputBytes, Number.MAX_SAFE_INTEGER),
    p_duration_ms: clampInt(body.durationMs, 24 * 60 * 60 * 1000),
    p_status: body.status === 'error' ? 'error' : 'success',
    p_error_code: typeof body.errorCode === 'string' ? body.errorCode.slice(0, 64) : null,
  });

  if (error) {
    console.error('usage log failed', { slug: tool.href, message: error.message });
    return NextResponse.json({ error: 'log failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
