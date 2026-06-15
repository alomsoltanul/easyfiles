'use client';

import React, { useRef, useEffect } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string | null;
  errorLine?: number;
  rows?: number;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  placeholder = 'Paste your JSON here...',
  label = 'Input',
  error,
  errorLine,
  rows = 16,
  readOnly,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, rows) }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          <span className="text-xs text-slate-400 font-mono">{value.length.toLocaleString()} chars · {lineCount} lines</span>
        </div>
      )}
      <div className={`relative border rounded-xl overflow-hidden transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400'}`}>
        <div className="flex">
          <div className="py-3 pl-3 pr-1 select-none text-right bg-slate-100 border-r border-slate-200">
            {lineNumbers.map((num) => (
              <div
                key={num}
                className={`text-xs font-mono leading-6 px-2 ${num === errorLine ? 'text-red-500 font-bold bg-red-50' : 'text-slate-400'}`}
              >
                {num}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            readOnly={readOnly}
            spellCheck={false}
            className="flex-1 py-3 px-4 text-sm font-mono leading-6 bg-transparent resize-none outline-none placeholder:text-slate-400 text-slate-800"
            style={{ lineHeight: '24px' }}
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 font-medium">
          {error}{errorLine ? ` (line ${errorLine})` : ''}
        </p>
      )}
    </div>
  );
}
