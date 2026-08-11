'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type EscapeTab = 'escape' | 'unescape';

export default function JsonEscape() {
  const [tab, setTab] = useState<EscapeTab>('escape');
  const [input, setInput] = useState('');

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null as string | null };
    if (tab === 'escape') {
      const escaped = JSON.stringify(input);
      return { output: escaped.slice(1, -1), error: null };
    }
    try {
      const trimmed = input.trim();
      const wrapped = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${input.replace(/"/g, '\\"')}"`;
      const parsed = JSON.parse(wrapped);
      return { output: String(parsed), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Invalid escaped string' };
    }
  }, [input, tab]);

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
        {([
          { id: 'escape' as EscapeTab, label: 'Escape' },
          { id: 'unescape' as EscapeTab, label: 'Unescape' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor
          value={input}
          onChange={setInput}
          placeholder={tab === 'escape' ? 'Enter text to escape for JSON...' : 'Paste escaped JSON string to unescape...'}
          label={tab === 'escape' ? 'Raw Text' : 'Escaped String'}
          error={error}
          rows={10}
        />

        {output && (
          <CodeOutput
            value={output}
            label={tab === 'escape' ? 'Escaped String' : 'Unescaped Text'}
            downloadFileName={tab === 'escape' ? 'escaped.json' : 'unescaped.txt'}
          />
        )}
      </div>
    </div>
  );
}
