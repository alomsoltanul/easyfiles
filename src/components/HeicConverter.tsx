'use client';

import React, { useState, useCallback } from 'react';
import { OutputFormat, ConversionResult, convertBulkToFormat } from '@/lib/converters';
import UploadZone from './UploadZone';
import ConversionResults from './ConversionResults';
import FormatSelector, { getOutputExtension } from './FormatSelector';

interface HeicConverterProps {
  defaultOutput: OutputFormat;
  title: string;
  description: string;
}

export default function HeicConverter({ defaultOutput, title, description }: HeicConverterProps) {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultOutput);
  const [files, setFiles] = useState<File[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    // Only accept HEIC files for this tool
    const heicFiles = selectedFiles.filter(f => {
      const name = f.name.toLowerCase();
      return f.type === 'image/heic' || f.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
    });
    if (heicFiles.length === 0 && selectedFiles.length > 0) {
      setError('Please upload HEIC/HEIF files only.');
      return;
    }
    setFiles(prev => [...prev, ...heicFiles]);
    setError(null);
    setResults(null);
  }, []);

  const removeFile = useCallback((i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setError(null);
    setProgress(0);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
      const converted = await convertBulkToFormat(
        files,
        outputFormat,
        { quality: 0.95 },
        (completed, total) => setProgress(Math.round((completed / total) * 100))
      );

      if (converted.length === 0) {
        throw new Error('No files were successfully converted.');
      }

      setResults(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
    } finally {
      setIsConverting(false);
    }
  }, [files, outputFormat]);

  const outputExt = getOutputExtension(outputFormat);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      {!results && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  {files.length === 0 ? 'Upload HEIC Photos' : 'Add More Photos'}
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  HEIC → {outputExt.toUpperCase().replace('.', '')}
                </span>
              </div>
              <UploadZone
                format={'heic-to-webp' as any}
                mode="bulk"
                onFilesSelected={handleFilesSelected}
                disabled={isConverting}
                acceptAllImages
                inputFormat="heic"
              />
              {files.length > 0 && (
                <p className="text-sm text-slate-500 mt-3 text-center">
                  <span className="font-semibold text-slate-700">{files.length}</span> file{files.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {files.length > 0 && (
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-800">{files.length} File{files.length !== 1 ? 's' : ''}</h2>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border">
                      <span className="text-xs font-bold text-slate-400 w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-all"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Output Format</h2>
                <div className="flex gap-2">
                  {([
                    { value: 'image/png' as OutputFormat, label: 'PNG' },
                    { value: 'image/jpeg' as OutputFormat, label: 'JPEG' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setOutputFormat(opt.value)}
                      className={`
                        px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border
                        ${outputFormat === opt.value
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {files.length > 0 && (
              <div className="border-t border-slate-100 pt-6">
                {isConverting ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>Converting {files.length} HEIC file{files.length !== 1 ? 's' : ''}...</span>
                      <span className="text-emerald-600">{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleConvert}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Convert to {outputExt.toUpperCase().replace('.', '')}
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Conversion Complete!</h2>
                <p className="text-sm text-slate-500">Your HEIC photos are ready for download</p>
              </div>
            </div>
            <ConversionResults results={results} onClear={handleReset} />
          </div>
        </div>
      )}

      {infoCards}
    </div>
  );
}

const infoCards = (
  <div className="grid sm:grid-cols-3 gap-4 mt-8">
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <h3 className="font-semibold text-slate-800 text-sm mb-1">Private & Secure</h3>
      <p className="text-xs text-slate-500 leading-relaxed">All conversions happen directly in your browser. Your photos never leave your device.</p>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <h3 className="font-semibold text-slate-800 text-sm mb-1">Lightning Fast</h3>
      <p className="text-xs text-slate-500 leading-relaxed">HEIC decoding happens locally with no server uploads required.</p>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      </div>
      <h3 className="font-semibold text-slate-800 text-sm mb-1">Bulk Convert</h3>
      <p className="text-xs text-slate-500 leading-relaxed">Process multiple HEIC photos at once with a single click.</p>
    </div>
  </div>
);
