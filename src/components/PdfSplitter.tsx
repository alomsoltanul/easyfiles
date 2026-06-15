'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { renderPDFThumbnails } from '@/lib/pdf-render';
import { formatFileSize } from '@/lib/converters';

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'selected' | 'all'>('selected');
  
  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'split',
    options: {
      mode,
      pages: Array.from(selectedPages),
    },
  });

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setSelectedPages(new Set());
    setLoading(true);
    try {
      const thumbs = await renderPDFThumbnails(f, 0.5);
      setThumbnails(thumbs);
      setSelectedPages(new Set(Array.from({ length: thumbs.length }, (_, i) => i + 1)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
    reset();
  }, [reset]);

  const togglePage = useCallback((page: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }, []);

  const handleSplit = useCallback(async () => {
    if (!file) return;
    setMode('selected');
    await process([file], { mode: 'selected' });
  }, [file, process]);

  const handleSplitAll = useCallback(async () => {
    if (!file) return;
    setMode('all');
    await process([file], { mode: 'all' });
  }, [file, process]);

  const handleReset = useCallback(() => {
    setFile(null);
    setThumbnails([]);
    setSelectedPages(new Set());
    setMode('selected');
    reset();
  }, [reset]);

  return (
    <div className="space-y-8">
      {!file ? (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upload PDF</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (files[0]) handleFile(files[0]); }}
            onClick={() => pickRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
          >
              <input ref={pickRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} className="hidden" />
            <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Drop your PDF here</h3>
            <p className="text-slate-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(file.size)} · {thumbnails.length} pages</p>
            </div>
            <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700">Change</button>
          </div>

          {loading && <p className="text-sm text-slate-500 text-center py-8">Loading pages...</p>}

          {!loading && thumbnails.length > 0 && !result && (
            <>
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-800">Select Pages</h2>
                  <span className="text-xs text-slate-500">{selectedPages.size} selected</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {thumbnails.map((thumb, i) => {
                    const page = i + 1;
                    const isSelected = selectedPages.has(page);
                    return (
                      <button key={i} onClick={() => togglePage(page)}
                        className={`relative rounded-xl border-2 overflow-hidden transition-all ${isSelected ? 'border-emerald-500 shadow-sm shadow-emerald-200' : 'border-slate-200 opacity-60 hover:opacity-80'}`}>
                        <img src={thumb} alt={`Page ${page}`} className="w-full h-auto" />
                        <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}>{page}</span>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>
              )}

              <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-3">
                <button onClick={handleSplit} disabled={isProcessing || selectedPages.size === 0}
                  className="py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-emerald-200">
                  Extract Selected
                </button>
                <button onClick={handleSplitAll} disabled={isProcessing}
                  className="py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl text-sm transition-all">
                  Split All Pages
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Split Complete!</h2>
                  <p className="text-sm text-slate-500">{result.name}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{result.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(result.size)}</p>
                </div>
                <button onClick={download}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
              </div>
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Split Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
