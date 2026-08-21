import { usagePercent } from '@/lib/format';

/**
 * One quota row: what has been used against what the plan allows. An unlimited
 * allowance shows the count with no bar — a full-width bar would read as "at
 * the limit", which is the opposite of the truth.
 */
export default function UsageBar({
  label,
  used,
  limit,
  suffix = '',
}: {
  label: string;
  used: number;
  limit: number | null;
  suffix?: string;
}) {
  const percent = usagePercent(used, limit);
  const nearLimit = percent >= 80;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-slate-600">{label}</span>
        <span className={`text-[13px] font-semibold ${nearLimit ? 'text-amber-600' : 'text-slate-800'}`}>
          {used}
          {limit === null ? (
            <span className="font-medium text-slate-400"> {suffix} · unlimited</span>
          ) : (
            <span className="font-medium text-slate-400">
              {' '}
              / {limit} {suffix}
            </span>
          )}
        </span>
      </div>

      {limit !== null && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
