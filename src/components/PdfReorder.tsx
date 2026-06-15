'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { renderPDFThumbnails } from '@/lib/pdf-render';
import { formatFileSize } from '@/lib/converters';

export default function PdfReorder() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  
  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'reorder',
    options: { order: pageOrder },
  });

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setThumbnails([]);
    setPageOrder([]);
    setLoading(true);
    try {
      const thumbs = await renderPDFThumbnails(f, 0.5);
      setThumbnails(thumbs);
      setPageOrder(Array.from({ length: thumbs.length }, (_, i) => i + 1));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
    reset();
  }, [reset]);

  const movePage = useCallback((from: number, to: number) => {
    setPageOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    await process([file]);
  }, [file, process]);

  const handleReset = useCallback(() => {
    setFile(null);
    setThumbnails([]);
    setPageOrder([]);
    reset();
  }, [reset]);

  return (
    <div className="space-y-8">
      {!file ? (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upload PDF</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf'); if (f) handleFile(f); }}
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
                  <h2 className="text-lg font-bold text-slate-800">Drag to Reorder</h2>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pageOrder.map((page, index) => (
                    <div key={page} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div className="flex items-center gap-1">
                        <button onClick={() => index > 0 && movePage(index, index - 1)} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => index < pageOrder.length - 1 && movePage(index, index + 1)} disabled={index === pageOrder.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                        <img src={thumbnails[page - 1]} alt={`Page ${page}`} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-sm font-medium text-slate-800">Page {page}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button onClick={handleProcess} disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                  {isProcessing ? 'Processing...' : 'Reorder PDF'}
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
                  <h2 className="text-lg font-bold text-slate-800">PDF Reordered!</h2>
                  <p className="text-sm text-slate-500">{result.name}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{result.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(result.size)}</p>
                </div>
                <button onClick={download} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
              </div>
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Reorder Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
