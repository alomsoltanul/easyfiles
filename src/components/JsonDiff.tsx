'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type DiffLine = {
  type: 'equal' | 'added' | 'removed' | 'modified';
  text: string;
};

function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const result: DiffLine[] = [];

  let li = 0, ri = 0;
  while (li < leftLines.length || ri < rightLines.length) {
    if (li >= leftLines.length) {
      result.push({ type: 'added', text: '+ ' + rightLines[ri] });
      ri++;
    } else if (ri >= rightLines.length) {
      result.push({ type: 'removed', text: '- ' + leftLines[li] });
      li++;
    } else if (leftLines[li] === rightLines[ri]) {
      result.push({ type: 'equal', text: '  ' + leftLines[li] });
      li++; ri++;
    } else {
      const lookAhead = rightLines.indexOf(leftLines[li], ri);
      if (lookAhead !== -1 && lookAhead - ri <= 3) {
        for (let j = ri; j < lookAhead; j++) {
          result.push({ type: 'added', text: '+ ' + rightLines[j] });
        }
        result.push({ type: 'equal', text: '  ' + leftLines[li] });
        li++; ri = lookAhead + 1;
      } else {
        result.push({ type: 'removed', text: '- ' + leftLines[li] });
        li++;
        if (ri < rightLines.length) {
          result.push({ type: 'added', text: '+ ' + rightLines[ri] });
          ri++;
        }
      }
    }
  }

  return result;
}

export default function JsonDiff() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { diff, formatted } = useMemo(() => {
    if (!left.trim() || !right.trim()) return { diff: null, formatted: '' };
    try {
      const leftParsed = JSON.parse(left);
      const rightParsed = JSON.parse(right);
      const leftFormatted = JSON.stringify(leftParsed, null, 2);
      const rightFormatted = JSON.stringify(rightParsed, null, 2);
      setError(null);
      const d = computeDiff(leftFormatted, rightFormatted);
      const f = d.map((l) => l.text).join('\n');
      return { diff: d, formatted: f };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      return { diff: null, formatted: '' };
    }
  }, [left, right]);

  const lineColors: Record<string, string> = {
    equal: 'text-slate-600',
    added: 'text-emerald-600 bg-emerald-50',
    removed: 'text-red-600 bg-red-50',
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

      {diff && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Differences</label>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-96 overflow-y-auto">
            <pre className="p-4 text-sm font-mono leading-6">
              {diff.map((line, i) => (
                <div key={i} className={`${lineColors[line.type]} leading-6`}>{line.text}</div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
