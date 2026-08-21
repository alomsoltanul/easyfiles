import { listToolFlags } from '@/lib/admin-data';
import { TOOLS } from '@/lib/tools';
import { Panel, TableScroll } from '@/components/admin/primitives';
import ToolFlagRow from '@/components/admin/ToolFlagRow';

export default async function ConsoleToolsPage() {
  const flags = await listToolFlags();

  const overridden = TOOLS.filter((tool) => {
    const flag = flags.get(tool.href);
    return flag && (flag.access !== null || !flag.enabled);
  }).length;

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[13px] leading-relaxed text-slate-500">
        Every tool page runs through the same gate, so a change here takes effect without a deploy —
        within a minute on all instances. {overridden} of {TOOLS.length} tools currently differ from
        their built-in setting. Taking a tool offline makes its page return the site&apos;s 404,
        which also drops it out of search results while it is down.
      </p>

      <Panel title={`${TOOLS.length} tools`}>
        <TableScroll>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-bold">Tool</th>
                <th className="px-3 py-2.5 font-bold">Dept</th>
                <th className="px-3 py-2.5 font-bold">Built-in</th>
                <th className="px-3 py-2.5 font-bold">Live setting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TOOLS.map((tool) => {
                const flag = flags.get(tool.href);
                return (
                  <ToolFlagRow
                    key={tool.href}
                    slug={tool.href}
                    label={tool.label}
                    dept={tool.dept}
                    defaultAccess={tool.access}
                    access={flag?.access ?? null}
                    enabled={flag?.enabled ?? true}
                  />
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    </div>
  );
}
