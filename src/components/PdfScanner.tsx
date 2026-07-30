'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';

export default function PdfScanner() {
  const [files, setFiles] = useState<File[]>([]);
  const [autoDetect, setAutoDetect] = useState(true);
  const [grayscale, setGrayscale] = useState(true);
  const [brightness, setBrightness] = useState(0);
  
  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'scan-to-pdf',
    options: { autoDetect, grayscale, brightness },
  });

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => { for (const u of previews) URL.revokeObjectURL(u); }, [previews]);

  const handleFiles = useCallback((newFiles: File[]) => {
    const images = newFiles.filter(f => /image\//.test(f.type));
    setFiles(prev => [...prev, ...images]);
  }, []);

  const removeFile = useCallback((i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i)), []);

  const moveFile = useCallback((from: number, to: number) => {
    setFiles(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const handleScan = useCallback(async () => {
    if (files.length === 0) return;
    await process(files);
  }, [files, process]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setBrightness(0);
    reset();
  }, [reset]);

  return (
    <div className="space-y-8">
      {!result && (
        <>
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Upload Document Photos</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
              onClick={() => pickRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
            >
                <input ref={pickRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ''; }} className="hidden" />
              <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Drop photos of your documents</h3>
              <p className="text-slate-500 text-sm">or click to browse — you can upload multiple</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">{files.length} Photo{files.length !== 1 ? 's' : ''}</h2>
                <span className="text-xs text-slate-500">Drag to reorder</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border">
                    <div className="flex items-center gap-1">
                      <button onClick={() => i > 0 && moveFile(i, i - 1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                      <button onClick={() => i < files.length - 1 && moveFile(i, i + 1)} disabled={i === files.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-6">{i + 1}</span>
                    <img src={previews[i]} alt={file.name} className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white flex-shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{file.name}</p><p className="text-xs text-slate-500">{formatFileSize(file.size)}</p></div>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} className="w-4 h-4 text-emerald-500 rounded border-slate-300" />
                <span className="text-sm text-slate-700">Auto-detect edges & rotate</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="w-4 h-4 text-emerald-500 rounded border-slate-300" />
                <span className="text-sm text-slate-700">Grayscale</span>
              </label>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Brightness: {brightness > 0 ? '+' : ''}{brightness}%</label>
                <input type="range" min="-50" max="50" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <button onClick={handleScan} disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200">
                {isProcessing ? (
                  <>Scanning & Enhancing {files.length} page{files.length !== 1 ? 's' : ''}...</>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Scan {files.length} Document{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Scan Complete!</h2>
              <p className="text-sm text-slate-500">{files.length} page{files.length !== 1 ? 's' : ''} enhanced & ready</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={download}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-emerald-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download PDF
            </button>
            <button onClick={handleReset} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Scan Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
