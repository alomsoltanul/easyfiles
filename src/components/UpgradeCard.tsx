import Link from 'next/link';
import { LISTED_PLANS, formatPrice } from '@/lib/plans';
import { FREE_TOOL_COUNT, ICONS, toolByHref } from '@/lib/tools';

/**
 * Shown in place of a paid tool's controls. Everything above it — the title,
 * description and info cards in ToolLayout — still renders, so the page keeps
 * its SEO value and a first-time visitor still learns what the tool does.
 */
export default function UpgradeCard({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const tool = toolByHref(slug);
  const cheapest = LISTED_PLANS[0];

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 p-3 text-amber-600">
        {ICONS.lock}
      </span>

      <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
        {tool ? `${tool.label} is part of the paid plans` : 'This tool is part of the paid plans'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {tool?.description ?? 'Unlock this tool with any paid plan.'} Every plan includes it, from{' '}
        {formatPrice(cheapest.monthlyPrice)}/month.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href="/pricing"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
        >
          See the plans
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        {!signedIn && (
          <Link
            href={`/account/sign-in?next=${encodeURIComponent(slug)}`}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 sm:w-auto"
          >
            I already have a plan
          </Link>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[13px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-700">{FREE_TOOL_COUNT} of our tools stay free</span>{' '}
          and need no account — merging, splitting, compressing, image conversion and every JSON
          tool.{' '}
          <Link href="/" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Browse the free tools
          </Link>
        </p>
      </div>
    </div>
  );
}
