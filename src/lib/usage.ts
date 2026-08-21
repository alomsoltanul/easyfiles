'use client';

/**
 * Client-side hook into the history feature.
 *
 * Fire-and-forget by design: a tool has already produced its output by the time
 * this runs, so a logging failure must never turn into a user-visible error.
 * Anonymous visitors are a no-op on the server side.
 */

import type { RunStatus } from './supabase/database.types';

export interface RunRecord {
  /** Tool.href, which is also the page route. */
  slug: string;
  fileCount?: number;
  inputBytes?: number;
  outputBytes?: number;
  durationMs?: number;
  status?: RunStatus;
  errorCode?: string | null;
}

export function logRun(record: RunRecord): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify(record);

  // sendBeacon survives the page being closed right after a download starts,
  // which is exactly when a lot of these fire.
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon('/api/usage/log', new Blob([body], { type: 'application/json' }));
    if (ok) return;
  }

  void fetch('/api/usage/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {
    /* history is best-effort */
  });
}

/** Total bytes across a file list, for the history row. */
export function totalBytes(files: { size: number }[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

/** Current page path, which equals the tool slug. */
export function currentSlug(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}
