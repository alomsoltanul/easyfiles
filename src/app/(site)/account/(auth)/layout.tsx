import Link from 'next/link';
import { TOOL_COUNT } from '@/lib/tools';

/**
 * Shell for the signed-out auth screens. Deliberately separate from the
 * dashboard layout in (dashboard), which requires a session.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:px-6 lg:py-20">
      <Link href="/" className="mx-auto mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight text-slate-900">ConvertTools</span>
          <span className="block text-[11px] font-medium text-slate-400">{TOOL_COUNT} browser tools</span>
        </span>
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Your files are converted in your browser and never uploaded. An account only stores which
        tools you used, never the files themselves.
      </p>
    </div>
  );
}
