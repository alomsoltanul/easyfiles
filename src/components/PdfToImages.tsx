'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';

export default function PdfToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [dpi, setDpi] = useState(150);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: format === 'jpeg' ? 'pdf-to-jpg' : 'pdf-to-png',
    options: { format, dpi },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    reset();
  }, [reset]);

  const handleConvert = useCallback(async () => {
    if (!file) return;
    await process([file]);
  }, [file, process]);

  const handleReset = useCallback(() => {
    setFile(null);
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
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
          >
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
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
              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700">Change</button>
          </div>

          {!result && (
            <>
              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">Output Format</h2>
                <div className="flex gap-2">
                  <button onClick={() => setFormat('jpeg')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${format === 'jpeg' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    JPEG
                  </button>
                  <button onClick={() => setFormat('png')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${format === 'png' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    PNG
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">DPI</h2>
                <div className="flex gap-2">
                  {[72, 150, 300, 600].map(d => (
                    <button key={d} onClick={() => setDpi(d)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${dpi === d ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button onClick={handleConvert} disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                  {isProcessing ? 'Converting...' : 'Convert to Images'}
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
                  <h2 className="text-lg font-bold text-slate-800">Images Ready!</h2>
                  <p className="text-sm text-slate-500">{format.toUpperCase()} format</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{result.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(result.size)}</p>
                </div>
                <button onClick={download}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">Download</button>
              </div>
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Convert Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
