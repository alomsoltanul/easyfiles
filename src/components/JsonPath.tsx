'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type Segment =
  | { kind: 'root' }
  | { kind: 'key'; name: string }
  | { kind: 'index'; n: number }
  | { kind: 'slice'; start?: number; end?: number; step?: number }
  | { kind: 'wildcard' }
  | { kind: 'recursive' }
  | { kind: 'union'; keys: (string | number)[] }
  | { kind: 'filter'; expr: string };

function tokenize(path: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  if (path[i] === '$') { out.push({ kind: 'root' }); i++; }
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      if (path[i + 1] === '.') {
        out.push({ kind: 'recursive' });
        i += 2;
        continue;
      }
      i++;
      if (path[i] === '*') { out.push({ kind: 'wildcard' }); i++; continue; }
      let j = i;
      while (j < path.length && /[A-Za-z0-9_$]/.test(path[j])) j++;
      if (j > i) { out.push({ kind: 'key', name: path.slice(i, j) }); i = j; continue; }
      continue;
    }
    if (ch === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) throw new Error('Unclosed bracket in JSONPath');
      const inner = path.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === '*') { out.push({ kind: 'wildcard' }); continue; }
      if (inner.startsWith('?')) {
        let expr = inner.slice(1).trim();
        if (expr.startsWith('(') && expr.endsWith(')')) expr = expr.slice(1, -1);
        out.push({ kind: 'filter', expr });
        continue;
      }
      if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
        out.push({ kind: 'key', name: inner.slice(1, -1) });
        continue;
      }
      if (inner.includes(',')) {
        const parts = inner.split(',').map((s) => s.trim()).map((s) => {
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
          const n = Number(s);
          return Number.isFinite(n) ? n : s;
        });
        out.push({ kind: 'union', keys: parts });
        continue;
      }
      if (inner.includes(':')) {
        const [s, e, st] = inner.split(':').map((p) => p.trim());
        const parse = (v: string) => (v === '' ? undefined : Number(v));
        out.push({ kind: 'slice', start: parse(s), end: parse(e), step: parse(st) });
        continue;
      }
      const n = Number(inner);
      if (Number.isFinite(n)) { out.push({ kind: 'index', n }); continue; }
      out.push({ kind: 'key', name: inner });
      continue;
    }
    i++;
  }
  return out;
}

function evalFilter(item: unknown, expr: string): boolean {
  try {
    const fn = new Function('$', `with ($) { return (${expr.replace(/@/g, '$')}); }`);
    if (item === null || typeof item !== 'object') {
      const fn2 = new Function('$value', `return (${expr.replace(/@/g, '$value')});`);
      return Boolean(fn2(item));
    }
    return Boolean(fn(item));
  } catch {
    return false;
  }
}

function applySegment(nodes: unknown[], seg: Segment): unknown[] {
  const out: unknown[] = [];
  for (const node of nodes) {
    if (seg.kind === 'root') { out.push(node); continue; }
    if (seg.kind === 'key') {
      if (node && typeof node === 'object' && !Array.isArray(node) && seg.name in (node as Record<string, unknown>)) {
        out.push((node as Record<string, unknown>)[seg.name]);
      } else if (Array.isArray(node)) {
        for (const child of node) {
          if (child && typeof child === 'object' && seg.name in (child as Record<string, unknown>)) {
            out.push((child as Record<string, unknown>)[seg.name]);
          }
        }
      }
      continue;
    }
    if (seg.kind === 'index') {
      if (Array.isArray(node)) {
        const idx = seg.n < 0 ? node.length + seg.n : seg.n;
        if (idx >= 0 && idx < node.length) out.push(node[idx]);
      }
      continue;
    }
    if (seg.kind === 'wildcard') {
      if (Array.isArray(node)) out.push(...node);
      else if (node && typeof node === 'object') out.push(...Object.values(node));
      continue;
    }
    if (seg.kind === 'recursive') {
      const stack: unknown[] = [node];
      while (stack.length) {
        const cur = stack.pop()!;
        out.push(cur);
        if (Array.isArray(cur)) stack.push(...cur);
        else if (cur && typeof cur === 'object') stack.push(...Object.values(cur));
      }
      continue;
    }
    if (seg.kind === 'slice') {
      if (Array.isArray(node)) {
        const step = seg.step ?? 1;
        const start = seg.start ?? 0;
        const end = seg.end ?? node.length;
        for (let k = start; k < end; k += step) {
          if (k >= 0 && k < node.length) out.push(node[k]);
        }
      }
      continue;
    }
    if (seg.kind === 'union') {
      if (Array.isArray(node)) {
        for (const k of seg.keys) {
          if (typeof k === 'number') {
            const idx = k < 0 ? node.length + k : k;
            if (idx >= 0 && idx < node.length) out.push(node[idx]);
          }
        }
      } else if (node && typeof node === 'object') {
        for (const k of seg.keys) {
          const key = String(k);
          if (key in (node as Record<string, unknown>)) out.push((node as Record<string, unknown>)[key]);
        }
      }
      continue;
    }
    if (seg.kind === 'filter') {
      const items = Array.isArray(node) ? node : node && typeof node === 'object' ? Object.values(node) : [];
      for (const it of items) {
        if (evalFilter(it, seg.expr)) out.push(it);
      }
      continue;
    }
  }
  return out;
}

function runJsonPath(root: unknown, path: string): unknown[] {
  const segs = tokenize(path);
  let nodes: unknown[] = [root];
  for (const s of segs) {
    if (s.kind === 'root') continue;
    nodes = applySegment(nodes, s);
  }
  return nodes;
}

export default function JsonPath() {
  const [jsonInput, setJsonInput] = useState('');
  const [path, setPath] = useState('$');

  const { results, error } = useMemo(() => {
    if (!jsonInput.trim()) return { results: null, error: null };
    try {
      const obj = JSON.parse(jsonInput);
      const r = runJsonPath(obj, path);
      return { results: r, error: null };
    } catch (e) {
      return { results: null, error: e instanceof Error ? e.message : 'Error' };
    }
  }, [jsonInput, path]);

  const formatted = results ? JSON.stringify(results, null, 2) : '';

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">JSONPath Expression</label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="$.store.books[*].title"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
        />
        <p className="text-xs text-slate-400 mt-2">
          Supports: <code className="bg-slate-100 px-1 rounded">$.name</code>, <code className="bg-slate-100 px-1 rounded">$.items[*].id</code>, <code className="bg-slate-100 px-1 rounded">$..author</code>, <code className="bg-slate-100 px-1 rounded">$.list[1:3]</code>, <code className="bg-slate-100 px-1 rounded">$.books[?(@.price&lt;10)]</code>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor value={jsonInput} onChange={setJsonInput} placeholder="Paste JSON to query..." label="JSON Input" error={error} rows={14} />

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
    </div>
  );
}
