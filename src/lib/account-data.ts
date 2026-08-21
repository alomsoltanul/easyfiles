import 'server-only';

import { createSupabaseServerClient } from './supabase/server';
import type { ToolRun } from './supabase/database.types';

/**
 * Reads for the signed-in user's dashboard. Every query runs through the
 * cookie-scoped client, so RLS — not application code — is what keeps one
 * user's history out of another's pages.
 */

export interface HistoryPage {
  runs: ToolRun[];
  total: number;
}

export interface HistoryQuery {
  page?: number;
  pageSize?: number;
  dept?: string;
  status?: 'success' | 'error';
}

export async function getHistory(userId: string, query: HistoryQuery = {}): Promise<HistoryPage> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { runs: [], total: 0 };

  const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const from = (page - 1) * pageSize;

  let request = supabase
    .from('tool_runs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (query.dept) request = request.eq('dept', query.dept);
  if (query.status) request = request.eq('status', query.status);

  const { data, count, error } = await request;
  if (error) return { runs: [], total: 0 };

  return { runs: data ?? [], total: count ?? 0 };
}

export async function getRecentRuns(userId: string, limit = 6): Promise<ToolRun[]> {
  const { runs } = await getHistory(userId, { page: 1, pageSize: limit });
  return runs;
}

export interface RunStats {
  runsThisMonth: number;
  bytesThisMonth: number;
  /** [toolSlug, label, count], most used first */
  topTools: { slug: string; label: string; count: number }[];
  failures: number;
}

export async function getRunStats(userId: string): Promise<RunStats> {
  const supabase = await createSupabaseServerClient();
  const empty: RunStats = { runsThisMonth: 0, bytesThisMonth: 0, topTools: [], failures: 0 };
  if (!supabase) return empty;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('tool_runs')
    .select('tool_slug, label, input_bytes, status')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString());

  if (error || !data) return empty;

  const counts = new Map<string, { label: string; count: number }>();
  let bytes = 0;
  let failures = 0;

  for (const row of data) {
    bytes += row.input_bytes;
    if (row.status === 'error') failures += 1;
    const existing = counts.get(row.tool_slug);
    if (existing) existing.count += 1;
    else counts.set(row.tool_slug, { label: row.label ?? row.tool_slug, count: 1 });
  }

  const topTools = [...counts.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { runsThisMonth: data.length, bytesThisMonth: bytes, topTools, failures };
}

/** Wipes the caller's own history. Used by the settings page. */
export async function clearHistory(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.from('tool_runs').delete().eq('user_id', userId);
  return !error;
}
