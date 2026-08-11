'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type Stats = { keys: number; arrays: number; objects: number; depth: number };

function analyze(value: unknown, depth = 0): Stats {
  const stats: Stats = { keys: 0, arrays: 0, objects: 0, depth };
  if (Array.isArray(value)) {
    stats.arrays = 1;
    for (const item of value) {
      const sub = analyze(item, depth + 1);
      stats.keys += sub.keys;
      stats.arrays += sub.arrays;
      stats.objects += sub.objects;
      stats.depth = Math.max(stats.depth, sub.depth);
    }
  } else if (value && typeof value === 'object') {
    stats.objects = 1;
    for (const v of Object.values(value)) {
      stats.keys += 1;
      const sub = analyze(v, depth + 1);
      stats.keys += sub.keys;
      stats.arrays += sub.arrays;
      stats.objects += sub.objects;
      stats.depth = Math.max(stats.depth, sub.depth);
    }
  }
  return stats;
}

function locate(input: string, pos: number) {
  const before = input.substring(0, pos);
  const lines = before.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  const allLines = input.split('\n');
  const snippet = allLines[line - 1] ?? '';
  return { line, column, snippet };
}

export default function JsonValidator() {
  const [input, setInput] = useState('');

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const parsed = JSON.parse(input);
      const stats = analyze(parsed);
      return { valid: true as const, formatted: JSON.stringify(parsed, null, 2), stats };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      const match = msg.match(/position\s+(\d+)/);
      let line: number | undefined;
      let column: number | undefined;
      let snippet: string | undefined;
      if (match) {
        const loc = locate(input, parseInt(match[1]));
        line = loc.line;
        column = loc.column;
        snippet = loc.snippet;
      }
      return { valid: false as const, error: msg, line, column, snippet };
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor
          value={input}
          onChange={setInput}
          placeholder="Paste JSON to validate..."
          label="JSON Input"
          error={result && !result.valid ? result.error : null}
          errorLine={result && !result.valid ? result.line : undefined}
          rows={16}
        />

        {result?.valid && (
          <CodeOutput value={result.formatted} label="Formatted JSON" downloadFileName="formatted.json" />
        )}

        {result && !result.valid && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-red-800">Invalid JSON</p>
                <p className="text-sm text-red-700 break-words">{result.error}</p>
              </div>
            </div>

            {result.line !== undefined && (
              <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                <div className="px-3 py-2 bg-red-100/50 border-b border-red-100 text-xs font-mono text-red-700 flex items-center justify-between">
                  <span>Line {result.line}{result.column ? `, Column ${result.column}` : ''}</span>
                  <span className="text-[10px] uppercase tracking-wide text-red-500">error here ↓</span>
                </div>
                <pre className="p-3 text-xs font-mono leading-5 overflow-x-auto whitespace-pre text-slate-700">
                  <div className="text-slate-400">{result.line}  {result.snippet}</div>
                  {result.column && (
                    <div className="text-red-500">
                      {' '.repeat(String(result.line).length + 2)}{' '.repeat(Math.max(0, result.column - 1))}^
                    </div>
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {result?.valid && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="font-bold text-emerald-800">Valid JSON</p>
              <p className="text-sm text-emerald-700">Syntax is correct.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { label: 'Keys', value: result.stats.keys },
              { label: 'Objects', value: result.stats.objects },
              { label: 'Arrays', value: result.stats.arrays },
              { label: 'Max Depth', value: result.stats.depth },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg p-2 border border-emerald-100">
                <div className="text-emerald-600 font-bold text-lg leading-none">{s.value}</div>
                <div className="text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
