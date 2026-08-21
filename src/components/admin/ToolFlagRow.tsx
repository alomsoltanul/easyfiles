'use client';

import { useActionState } from 'react';
import { setToolFlagAction, type AdminActionState } from '@/app/(admin)/console/actions';
import type { ToolAccess } from '@/lib/tool-access';

const EMPTY: AdminActionState = {};

/**
 * One row of the tools screen. Each row is its own form so a change saves on
 * its own — a single form over 56 tools would make every save a mass update.
 */
export default function ToolFlagRow({
  slug,
  label,
  dept,
  defaultAccess,
  access,
  enabled,
}: {
  slug: string;
  label: string;
  dept: string;
  defaultAccess: ToolAccess;
  access: ToolAccess | null;
  enabled: boolean;
}) {
  const [state, submit] = useActionState(setToolFlagAction, EMPTY);
  const effective = access ?? defaultAccess;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-2.5">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="font-mono text-[11px] text-slate-400">{slug}</p>
      </td>
      <td className="px-3 py-2.5 text-xs uppercase tracking-wide text-slate-400">{dept}</td>
      <td className="px-3 py-2.5 text-xs text-slate-500">
        {defaultAccess === 'pro' ? 'Paid' : 'Free'}
        {access && access !== defaultAccess && (
          <span className="ml-1.5 font-bold text-violet-600">overridden</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <form action={submit} className="flex items-center gap-2">
          <input type="hidden" name="slug" value={slug} />

          <select
            name="access"
            defaultValue={effective}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:border-emerald-400 focus:outline-none"
          >
            <option value="free">Free</option>
            <option value="pro">Paid</option>
          </select>

          <select
            name="enabled"
            defaultValue={String(enabled)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:border-emerald-400 focus:outline-none"
          >
            <option value="true">Live</option>
            <option value="false">Offline</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-800"
          >
            Save
          </button>

          {state.error && <span className="text-[11px] font-semibold text-rose-600">{state.error}</span>}
          {state.notice && <span className="text-[11px] font-semibold text-emerald-600">Saved</span>}
        </form>
      </td>
    </tr>
  );
}
