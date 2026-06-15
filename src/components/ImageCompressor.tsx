'use client';

import React, { useState, useCallback } from 'react';
import { ConversionResult, convertBulkToFormat, OutputFormat } from '@/lib/converters';
import UploadZone from './UploadZone';
import ConversionResults from './ConversionResults';

export default function ImageCompressor() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(60);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
    setResults(null);
  }, []);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setError(null);
    setProgress(0);
  }, []);

  const handleCompress = useCallback(async () => {
    if (files.length === 0) return;
    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
      const targetFormat: OutputFormat = 'image/webp';
      const converted = await convertBulkToFormat(
        files,
        targetFormat,
        { quality: quality / 100 },
        (completed, total) => setProgress(Math.round((completed / total) * 100))
      );

      if (converted.length === 0) throw new Error('No files were successfully compressed.');
      setResults(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed.');
    } finally {
      setIsConverting(false);
    }
  }, [files, quality]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Upload Images</h2>
          {files.length > 0 && <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{files.length} file{files.length !== 1 ? 's' : ''}</span>}
        </div>
        <UploadZone mode="bulk" onFilesSelected={handleFilesSelected} disabled={isConverting} acceptAllImages label="Drop images to compress" description="or click to browse — JPEG, PNG, WebP" />
      </div>

      {files.length > 0 && (
        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Compression Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Quality</label>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{quality}%</span>
            </div>
            <input
              type="range" min="10" max="100" value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #10b981 0%, #10b981 ${quality}%, #e2e8f0 ${quality}%, #e2e8f0 100%)` }}
            />
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Smallest File</span>
              <span>Highest Quality</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {!results && files.length > 0 && (
        <div className="border-t border-slate-100 pt-6">
          {isConverting ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700"><span>Compressing...</span><span className="text-emerald-600">{progress}%</span></div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={handleCompress} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Compress Images
              </button>
              <button onClick={handleReset} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200">Reset</button>
            </div>
          )}
        </div>
      )}

      {results && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Compression Complete!</h2>
              <p className="text-sm text-slate-500">Your files are ready for download</p>
            </div>
          </div>
          <ConversionResults results={results} onClear={handleReset} />
        </div>
      )}
    </div>
  );
}
