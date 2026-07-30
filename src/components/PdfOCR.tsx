'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';
import PdfPreview from './PdfPreview';

export default function PdfOCR() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('eng');
  const [outputFormat, setOutputFormat] = useState('searchable-pdf');
  const [ocrText, setOcrText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, progress, result, error, process, download, reset } = usePdfTool({
    toolType: 'ocr',
    options: { language, outputFormat },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setOcrText('');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (f.type.startsWith('image/')) {
      setImagePreview(URL.createObjectURL(f));
    } else {
      setImagePreview(null);
    }
  }, [imagePreview]);

  const handleReset = useCallback(() => {
    setFile(null);
    setOcrText('');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    reset();
  }, [reset, imagePreview]);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    await process([file]);
  }, [file, process]);

  return (
    <div className="space-y-8">
      {!file ? (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upload PDF or Image</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf' || f.type.startsWith('image/')); if (f) handleFile(f); }}
            onClick={() => pickRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
          >
              <input ref={pickRef} type="file" accept=".pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} className="hidden" />
            <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Drop your file here</h3>
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

          {file.type === 'application/pdf' ? (
            <PdfPreview file={file} />
          ) : imagePreview ? (
            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Preview</h3>
              <div className="flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
                <img src={imagePreview} alt="Preview" className="max-h-64 w-auto rounded-lg shadow-sm border border-slate-200 bg-white" />
              </div>
            </div>
          ) : null}

          {!result && (
            <>
              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">OCR Language</h2>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium"
                >
                  <option value="eng">English</option>
                  <option value="jpn">Japanese</option>
                  <option value="ben">Bengali</option>
                  <option value="ara">Arabic</option>
                  <option value="chi_sim">Chinese (Simplified)</option>
                  <option value="kor">Korean</option>
                </select>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">Output Format</h2>
                <div className="flex gap-2">
                  {['searchable-pdf', 'text', 'json'].map(fmt => (
                    <button key={fmt} onClick={() => setOutputFormat(fmt)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${outputFormat === fmt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {fmt === 'searchable-pdf' ? 'Searchable PDF' : fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button onClick={handleProcess} disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                  {isProcessing ? `Processing... ${progress}%` : 'Run OCR'}
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
                  <h2 className="text-lg font-bold text-slate-800">OCR Complete!</h2>
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
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Process Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
