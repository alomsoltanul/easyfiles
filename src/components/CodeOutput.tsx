'use client';

import React, { useState, useCallback } from 'react';
import { formatFileSize } from '@/lib/converters';

interface CodeOutputProps {
  value: string;
  label?: string;
  language?: string;
  languageLabel?: string;
  onCopy?: () => void;
  downloadable?: boolean;
  downloadFileName?: string;
}

export default function CodeOutput({
  value,
  label = 'Output',
  language = 'json',
  languageLabel,
  onCopy,
  downloadable = true,
  downloadFileName = 'output.json',
}: CodeOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [value, onCopy]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [value, downloadFileName]);

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          {languageLabel && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {languageLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 font-mono mr-2">{value.length.toLocaleString()} chars · {lineCount} lines</span>
          {downloadable && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy
                </>
              )}
            </button>
          )}
          {downloadable && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
          )}
        </div>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
        <div className="flex">
          <div className="py-3 pl-3 pr-1 select-none text-right bg-slate-100 border-r border-slate-200">
            {lineNumbers.map((num) => (
              <div key={num} className="text-xs font-mono leading-6 px-2 text-slate-400">{num}</div>
            ))}
          </div>
          <pre className="flex-1 py-3 px-4 text-sm font-mono leading-6 text-slate-800 overflow-x-auto whitespace-pre" style={{ lineHeight: '24px' }}>
            {value || <span className="text-slate-400">No output</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}
