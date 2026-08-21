'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { currentSlug, logRun } from '@/lib/usage';
import CodeEditor from './CodeEditor';

type DiffLine = {
  type: 'equal' | 'added' | 'removed';
  text: string;
};

type SemDiff = {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
};

function computeLineDiff(left: string, right: string): DiffLine[] {
  const a = left.split('\n');
  const b = right.split('\n');
  const m = a.length, n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) lcs[i][j] = lcs[i + 1][j + 1] + 1;
      else lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: 'equal', text: '  ' + a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ type: 'removed', text: '- ' + a[i] }); i++; }
    else { out.push({ type: 'added', text: '+ ' + b[j] }); j++; }
  }
  while (i < m) { out.push({ type: 'removed', text: '- ' + a[i++] }); }
  while (j < n) { out.push({ type: 'added', text: '+ ' + b[j++] }); }
  return out;
}

function diffSemantic(a: unknown, b: unknown, path: string, out: SemDiff[]) {
  if (a === b) return;
  const aIsObj = a && typeof a === 'object' && !Array.isArray(a);
  const bIsObj = b && typeof b === 'object' && !Array.isArray(b);
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsObj && bIsObj) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) {
      const subPath = path ? `${path}.${k}` : k;
      const av = (a as Record<string, unknown>)[k];
      const bv = (b as Record<string, unknown>)[k];
      const aHas = k in (a as object);
      const bHas = k in (b as object);
      if (aHas && !bHas) out.push({ path: subPath, kind: 'removed', before: av });
      else if (!aHas && bHas) out.push({ path: subPath, kind: 'added', after: bv });
      else diffSemantic(av, bv, subPath, out);
    }
    return;
  }
  if (aIsArr && bIsArr) {
    const max = Math.max((a as unknown[]).length, (b as unknown[]).length);
    for (let i = 0; i < max; i++) {
      const subPath = `${path}[${i}]`;
      const av = (a as unknown[])[i];
      const bv = (b as unknown[])[i];
      if (i >= (a as unknown[]).length) out.push({ path: subPath, kind: 'added', after: bv });
      else if (i >= (b as unknown[]).length) out.push({ path: subPath, kind: 'removed', before: av });
      else diffSemantic(av, bv, subPath, out);
    }
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path: path || '$', kind: 'changed', before: a, after: b });
  }
}

export default function JsonDiff() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [mode, setMode] = useState<'line' | 'semantic'>('semantic');

  const { lineDiff, semDiff, equal, error } = useMemo(() => {
    if (!left.trim() || !right.trim()) return { lineDiff: null, semDiff: null, equal: false, error: null as string | null };
    try {
      const lp = JSON.parse(left);
      const rp = JSON.parse(right);
      const lf = JSON.stringify(lp, null, 2);
      const rf = JSON.stringify(rp, null, 2);
      const sem: SemDiff[] = [];
      diffSemantic(lp, rp, '', sem);
      return { lineDiff: computeLineDiff(lf, rf), semDiff: sem, equal: lf === rf, error: null };
    } catch (e) {
      return { lineDiff: null, semDiff: null, equal: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [left, right]);

  /*
   * This tool has no copy or download button to hang a run on, so record one
   * once the user has stopped typing on a diff that actually parsed. Debounced,
   * and guarded on the input pair, so editing doesn't log on every keystroke.
   */
  const loggedPair = useRef<string | null>(null);
  useEffect(() => {
    if (!lineDiff || error) return;
    const pair = `${left.length}:${right.length}`;
    if (loggedPair.current === pair) return;

    const timer = setTimeout(() => {
      loggedPair.current = pair;
      logRun({
        slug: currentSlug(),
        fileCount: 2,
        inputBytes: left.length + right.length,
        status: 'success',
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [lineDiff, error, left, right]);

  const lineColors: Record<string, string> = {
    equal: 'text-slate-600',
    added: 'text-emerald-700 bg-emerald-50',
    removed: 'text-red-700 bg-red-50',
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <CodeEditor value={left} onChange={setLeft} placeholder="Original JSON..." label="Left (Original)" rows={14} />
        <CodeEditor value={right} onChange={setRight} placeholder="New JSON..." label="Right (New)" rows={14} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>
      )}

      {lineDiff && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Differences</label>
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              {(['semantic', 'line'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-md font-semibold capitalize transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {equal ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm font-medium">
              JSON values are identical.
            </div>
          ) : mode === 'semantic' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-96 overflow-y-auto divide-y divide-slate-100">
              {semDiff && semDiff.length > 0 ? semDiff.map((d, i) => (
                <div key={i} className="p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${d.kind === 'added' ? 'bg-emerald-100 text-emerald-700' : d.kind === 'removed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{d.kind}</span>
                    <code className="font-mono text-xs text-slate-700 break-all">{d.path}</code>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
                    {d.kind !== 'added' && (
                      <div className="bg-red-50 border border-red-100 rounded p-2 break-all">
                        <div className="text-[10px] text-red-500 mb-1">before</div>
                        {JSON.stringify(d.before)}
                      </div>
                    )}
                    {d.kind !== 'removed' && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded p-2 break-all">
                        <div className="text-[10px] text-emerald-600 mb-1">after</div>
                        {JSON.stringify(d.after)}
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-4 text-sm text-slate-500">No semantic differences.</div>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-96 overflow-y-auto">
              <pre className="p-4 text-sm font-mono leading-6">
                {lineDiff.map((line, i) => (
                  <div key={i} className={`${lineColors[line.type]} leading-6`}>{line.text}</div>
                ))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
