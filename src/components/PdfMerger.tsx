'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';
import { renderPDFPage } from '@/lib/pdf-render';

export default function PdfMerger() {
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const { isProcessing, progress, result, error, process, download, reset } = usePdfTool({
    toolType: 'merge',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const f of files) {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (thumbs[key]) continue;
        try {
          const t = await renderPDFPage(f, 1, 0.5);
          if (cancelled) return;
          setThumbs(prev => ({ ...prev, [key]: t }));
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [files, thumbs]);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const pdfs = newFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    setFiles(prev => [...prev, ...pdfs]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50');
    handleFilesAdded(Array.from(e.dataTransfer.files));
  }, [handleFilesAdded]);

  const moveFile = useCallback((from: number, to: number) => {
    setFiles(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) return;
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
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add PDF Files</h2>
            <div
              ref={dragRef}
              onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add('border-emerald-500', 'bg-emerald-50/50'); }}
              onDragLeave={() => dragRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50')}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
            >
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={(e) => e.target.files && handleFilesAdded(Array.from(e.target.files))} className="hidden" />
              <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Drop PDF files here</h3>
              <p className="text-slate-500 text-sm mb-3">or click to browse</p>
              <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                PDF files accepted
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">Files to Merge ({files.length})</h2>
                <span className="text-xs text-slate-500">Drag to reorder</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    <div className="flex items-center gap-1">
                      <button onClick={() => index > 0 && moveFile(index, index - 1)} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                      <button onClick={() => index < files.length - 1 && moveFile(index, index + 1)} disabled={index === files.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
                    {thumbs[`${file.name}-${file.size}-${file.lastModified}`] ? (
                      <img src={thumbs[`${file.name}-${file.size}-${file.lastModified}`]} alt={file.name} className="w-10 h-12 object-cover rounded border border-slate-200 bg-white flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-12 rounded border border-slate-200 bg-slate-100 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button onClick={() => removeFile(index)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>
          )}

          {files.length >= 2 && (
            <div className="border-t border-slate-100 pt-6">
              <button
                onClick={handleMerge}
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
              >
                {isProcessing ? `Merging... ${progress}%` : `Merge ${files.length} PDFs`}
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
              <h2 className="text-lg font-bold text-slate-800">PDF Merged!</h2>
              <p className="text-sm text-slate-500">{files.length} files combined</p>
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
          <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Merge More Files</button>
        </div>
      )}
    </div>
  );
}
