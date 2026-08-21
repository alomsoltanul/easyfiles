/** Display helpers shared by the dashboard and the admin console. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 2411724 -> "2.3 MB" */
export function humanBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

/** 1450 -> "1.5s", 320 -> "320ms" */
export function humanDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/** "just now", "6 min ago", "3 days ago", then an absolute date. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < 7 * 86_400_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return formatDate(iso);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Percentage of a limit consumed, capped at 100. Null limit means unlimited. */
export function usagePercent(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
