'use client';

import Link from 'next/link';
import type { GateResult } from '@/lib/entitlements';

/**
 * Inline explanation when a plan limit blocks a file selection. Always names
 * the limit that was hit and the one action that clears it — a bare "not
 * allowed" would just read as a broken tool.
 */
export default function LimitNotice({
  block,
  signedIn,
  onDismiss,
}: {
  block: GateResult;
  signedIn: boolean;
  onDismiss?: () => void;
}) {
  if (block.ok) return null;

  const showSignUp = !signedIn && block.reason !== 'pro-tool';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.6 13.17A1.5 1.5 0 004.04 19.5h15.92a1.5 1.5 0 001.3-2.39l-7.6-13.17a1.5 1.5 0 00-2.6 0z"
        />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">{block.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {showSignUp && (
            <Link
              href="/account/sign-up"
              className="text-[13px] font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              Create a free account for higher limits
            </Link>
          )}
          <Link
            href="/pricing"
            className="text-[13px] font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            See the plans
          </Link>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[13px] font-semibold text-amber-700/70 hover:text-amber-900"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
