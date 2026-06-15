'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

function evaluateJsonPath(obj: unknown, path: string): unknown[] {
  const parts = parsePath(path);
  const results: unknown[] = [];
  walk(obj, parts, 0, results);
  return results;
}

function parsePath(path: string): (string | number)[] {
  const result: (string | number)[] = [];
  const re = /\$\.?|\.?(\w+)|\["([^"]+)"\]|'([^']+)'|\[(\d+)\]/g;
  let match;
  while ((match = re.exec(path)) !== null) {
    if (match[1]) result.push(match[1]);
    else if (match[2]) result.push(match[2]);
    else if (match[3]) result.push(match[3]);
    else if (match[4]) result.push(parseInt(match[4]));
  }
  return result;
}

function walk(node: unknown, parts: (string | number)[], idx: number, results: unknown[]) {
  if (idx >= parts.length) {
    results.push(node);
    return;
  }

  const part = parts[idx];

  if (part === '*') {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, parts, idx + 1, results));
    } else if (typeof node === 'object' && node !== null) {
      Object.values(node).forEach((item) => walk(item, parts, idx + 1, results));
    }
  } else if (typeof part === 'number') {
    if (Array.isArray(node) && part < node.length) {
      walk(node[part], parts, idx + 1, results);
    }
  } else {
    if (typeof node === 'object' && node !== null && part in node) {
      walk((node as Record<string, unknown>)[part], parts, idx + 1, results);
    }
  }
}

export default function JsonPath() {
  const [jsonInput, setJsonInput] = useState('');
  const [path, setPath] = useState('$');

  const { results, error } = useMemo(() => {
    if (!jsonInput.trim()) return { results: null, error: null };
    try {
      const obj = JSON.parse(jsonInput);
      const r = evaluateJsonPath(obj, path);
      return { results: r, error: null };
    } catch (e) {
      return { results: null, error: e instanceof Error ? e.message : 'Error' };
    }
  }, [jsonInput, path]);

  const formatted = results ? results.map((r) => JSON.stringify(r, null, 2)).join('\n---\n') : '';

  return (
    <div className="space-y-6">
      <CodeEditor value={jsonInput} onChange={setJsonInput} placeholder="Paste JSON to query..." label="JSON Input" error={error} rows={12} />

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">JSONPath Expression</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="$.store.books[*].title"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Examples: <code className="bg-slate-100 px-1 rounded">$.name</code>, <code className="bg-slate-100 px-1 rounded">$.items[*].id</code>, <code className="bg-slate-100 px-1 rounded">$..author</code>
        </p>
      </div>

      {results !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Results</label>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{results.length} match{results.length !== 1 ? 'es' : ''}</span>
          </div>
          {results.length > 0 ? (
            <CodeOutput value={formatted} label="" downloadFileName="jsonpath-results.json" />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm font-medium">No matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}
