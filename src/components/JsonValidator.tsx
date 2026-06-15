'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';

export default function JsonValidator() {
  const [input, setInput] = useState('');

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      JSON.parse(input);
      return { valid: true, error: null, line: undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      let line: number | undefined;
      const match = msg.match(/position\s+(\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        line = input.substring(0, pos).split('\n').length;
      }
      return { valid: false, error: msg, line };
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <CodeEditor
        value={input}
        onChange={setInput}
        placeholder="Paste JSON to validate..."
        label="JSON Input"
        rows={16}
      />

      {result && (
        <div className={`rounded-xl p-5 border ${result.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {result.valid ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="font-bold text-emerald-800">Valid JSON</p>
                <p className="text-sm text-emerald-700">Syntax is correct.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <p className="font-bold text-red-800">Invalid JSON</p>
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              </div>
              {result.line && (
                <p className="text-xs text-red-600 font-mono ml-[52px]">
                  Error near line {result.line}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
