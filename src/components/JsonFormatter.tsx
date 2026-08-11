'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';
import JsonTree from './JsonTree';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState(2);

  const { formatted, parsed, error, errorLine } = useMemo(() => {
    if (!input.trim()) return { formatted: '', parsed: null, error: null as string | null, errorLine: undefined as number | undefined };
    try {
      const obj = JSON.parse(input);
      return { formatted: JSON.stringify(obj, null, indent), parsed: obj, error: null, errorLine: undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      const match = msg.match(/position\s+(\d+)/);
      let line: number | undefined;
      if (match) {
        const pos = parseInt(match[1]);
        line = input.substring(0, pos).split('\n').length;
      }
      return { formatted: '', parsed: null, error: msg, errorLine: line };
    }
  }, [input, indent]);

  const isValid = !error && formatted !== '';

  return (
    <div className="space-y-6">
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

      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor
          value={input}
          onChange={setInput}
          placeholder='Paste JSON here, e.g. {"name": "John", "age": 30}'
          label="JSON Input"
          error={error}
          errorLine={errorLine}
          rows={12}
        />

        {isValid && (
          <CodeOutput
            value={formatted}
            label="Formatted JSON"
            language="json"
            downloadable
            downloadFileName="formatted.json"
          />
        )}
      </div>

      {isValid && parsed && <JsonTree data={parsed} />}
    </div>
  );
}
