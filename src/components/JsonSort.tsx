'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);

  const entries = Object.entries(obj as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, sortKeys(v)]);

  return Object.fromEntries(entries);
}

export default function JsonSort() {
  const [input, setInput] = useState('');

  const { sorted, error } = useMemo(() => {
    if (!input.trim()) return { sorted: '', error: null };
    try {
      const obj = JSON.parse(input);
      const s = sortKeys(obj);
      return { sorted: JSON.stringify(s, null, 2), error: null };
    } catch (e) {
      return { sorted: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <CodeEditor
        value={input}
        onChange={setInput}
        placeholder='Paste JSON, e.g. {"zebra":1,"alpha":2}'
        label="JSON Input"
        error={error}
        rows={12}
      />

      {sorted && (
        <CodeOutput value={sorted} label="Sorted JSON" downloadFileName="sorted.json" />
      )}
    </div>
  );
}
