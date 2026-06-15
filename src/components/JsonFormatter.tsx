'use client';

import React, { useState, useCallback, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';
import JsonTree from './JsonTree';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<number | undefined>(undefined);

  const { formatted, parsed } = useMemo(() => {
    if (!input.trim()) return { formatted: '', parsed: null };
    try {
      const obj = JSON.parse(input);
      return { formatted: JSON.stringify(obj, null, indent), parsed: obj };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      const match = msg.match(/position\s+(\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const lines = input.substring(0, pos).split('\n');
        setErrorLine(lines.length);
      }
      setError(msg);
      return { formatted: '', parsed: null };
    }
  }, [input, indent]);

  const isValid = !error && formatted !== '';

  return (
    <div className="space-y-6">
      <CodeEditor
        value={input}
        onChange={(v) => { setInput(v); setError(null); setErrorLine(undefined); }}
        placeholder='Paste JSON here, e.g. {"name": "John", "age": 30}'
        label="JSON Input"
        error={error}
        errorLine={errorLine}
        rows={12}
      />

      {input && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Indent:</span>
          {[2, 4, 8].map((n) => (
            <button
              key={n}
              onClick={() => setIndent(n)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${indent === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
            >
              {n} spaces
            </button>
          ))}
          <button
            onClick={() => setInput('')}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {isValid && (
        <>
          <CodeOutput
            value={formatted}
            label="Formatted JSON"
            language="json"
            downloadable
            downloadFileName="formatted.json"
          />
          {parsed && <JsonTree data={parsed} />}
        </>
      )}
    </div>
  );
}
