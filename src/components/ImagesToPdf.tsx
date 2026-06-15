'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';

type PageSize = 'A4' | 'Letter';

export default function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'stretch'>('contain');
  
  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'jpg-to-pdf',
    options: { pageSize, orientation, fitMode },
  });

  const handleFiles = useCallback((newFiles: File[]) => {
    const images = newFiles.filter(f => /image\/(jpeg|jpg|png|webp)/.test(f.type));
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

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    await process(files);
  }, [files, process]);

  const handleReset = useCallback(() => {
    setFiles([]);
    reset();
  }, [reset]);

  return (
    <div className="space-y-8">
      {!result && (
        <>
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Upload Images</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
              onClick={() => pickRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
            >
                <input ref={pickRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ''; }} className="hidden" />
              <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Drop your images here</h3>
              <p className="text-slate-500 text-sm">or click to browse</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">{files.length} Image{files.length !== 1 ? 's' : ''}</h2>
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
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{file.name}</p><p className="text-xs text-slate-500">{formatFileSize(file.size)}</p></div>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Page Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Page Size</label>
                  <div className="flex gap-2">
                    {['A4', 'Letter'].map(s => (
                      <button key={s} onClick={() => setPageSize(s as PageSize)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pageSize === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Orientation</label>
                  <div className="flex gap-2">
                    {['portrait', 'landscape'].map(o => (
                      <button key={o} onClick={() => setOrientation(o as 'portrait' | 'landscape')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border capitalize ${orientation === o ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Fit Mode</label>
                  <div className="flex gap-2">
                    {['contain', 'cover', 'stretch'].map(m => (
                      <button key={m} onClick={() => setFitMode(m as 'contain' | 'cover' | 'stretch')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border capitalize ${fitMode === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <button onClick={handleConvert} disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                {isProcessing ? 'Creating PDF...' : 'Create PDF'}
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
              <h2 className="text-lg font-bold text-slate-800">PDF Created!</h2>
              <p className="text-sm text-slate-500">{files.length} images · {formatFileSize(result.size)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={download}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-emerald-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download PDF
            </button>
            <button onClick={handleReset} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Create Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
