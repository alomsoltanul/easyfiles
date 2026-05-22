'use client';

import React, { useState, useCallback } from 'react';
import {
  ConversionFormat,
  ConversionResult,
  convertBulkToWebP,
  getFormatLabel,
} from '@/lib/converters';
import UploadZone from './UploadZone';
import CompressionSettings, { ResizePreset } from './CompressionSettings';
import ConversionResults from './ConversionResults';
import HeaderMenu from './HeaderMenu';

type Mode = 'single' | 'bulk';

const TABS: { id: ConversionFormat; label: string; icon: string }[] = [
  {
    id: 'png-to-webp',
    label: 'PNG to WebP',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'jpg-to-webp',
    label: 'JPG to WebP',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'heic-to-webp',
    label: 'HEIC to WebP',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

export default function ImageConverter() {
  const [activeTab, setActiveTab] = useState<ConversionFormat>('png-to-webp');
  const [mode, setMode] = useState<Mode>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(70);
  const [maxWidth, setMaxWidth] = useState<ResizePreset>('1024');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = useCallback((tab: ConversionFormat) => {
    setActiveTab(tab);
    handleReset();
  }, []);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
    setResults(null);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
      const converted = await convertBulkToWebP(
        files,
        {
          quality: quality / 100,
          maxWidth: maxWidth === 'original' ? undefined : parseInt(maxWidth),
        },
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
  }, [files, quality, maxWidth]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setError(null);
    setProgress(0);
  }, []);

  const formatLabel = getFormatLabel(activeTab);

  const handleDownloadAll = useCallback(() => {
    if (!results) return;
    results.forEach((result, index) => {
      setTimeout(() => {
        import('@/lib/converters').then(({ downloadImage }) => {
          downloadImage(result.convertedBlob, result.fileName);
        });
      }, index * 200);
    });
  }, [results]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Image to WebP</h1>
              <p className="text-xs text-slate-500 font-medium">Fast, secure, browser-based conversion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              100% Free & Private
            </div>
            <HeaderMenu
              activeTab={activeTab}
              onTabChange={handleTabChange}
              mode={mode}
              onModeChange={(newMode) => { setMode(newMode); handleReset(); }}
              quality={quality}
              onQualityChange={setQuality}
              maxWidth={maxWidth}
              onMaxWidthChange={setMaxWidth}
              filesCount={files.length}
              isConverting={isConverting}
              progress={progress}
              resultsCount={results?.length || 0}
              onConvert={handleConvert}
              onReset={handleReset}
              onDownloadAll={handleDownloadAll}
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Format Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 mb-6 shadow-sm">
          <div className="grid grid-cols-3 gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode Toggle */}
        {!results && (
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-full border border-slate-200 p-1 shadow-sm inline-flex">
              <button
                onClick={() => { setMode('single'); handleReset(); }}
                className={`
                  px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200
                  ${mode === 'single'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }
                `}
              >
                Single Image
              </button>
              <button
                onClick={() => { setMode('bulk'); handleReset(); }}
                className={`
                  px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200
                  ${mode === 'bulk'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }
                `}
              >
                Bulk Convert
              </button>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {!results ? (
            <div className="p-6 sm:p-8 space-y-8">
              {/* Upload Zone */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">
                    {mode === 'bulk' ? 'Upload Images' : 'Upload Image'}
                  </h2>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {formatLabel} → WebP
                  </span>
                </div>
                <UploadZone
                  format={activeTab}
                  mode={mode}
                  onFilesSelected={handleFilesSelected}
                  disabled={isConverting}
                />
                {mode === 'bulk' && files.length > 0 && (
                  <p className="text-sm text-slate-500 mt-3 text-center">
                    <span className="font-semibold text-slate-700">{files.length}</span> file{files.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Compression Settings */}
              {files.length > 0 && (
                <div className="border-t border-slate-100 pt-8">
                  <h2 className="text-lg font-bold text-slate-800 mb-4">Compression Settings</h2>
                  <CompressionSettings
                    quality={quality}
                    onQualityChange={setQuality}
                    maxWidth={maxWidth}
                    onMaxWidthChange={setMaxWidth}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Convert Button */}
              {files.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  {isConverting ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                        <span>Converting...</span>
                        <span className="text-emerald-600">{progress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
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
                        Convert to WebP
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
          ) : (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Conversion Complete!</h2>
                  <p className="text-sm text-slate-500">Your images are ready for download</p>
                </div>
              </div>

              <ConversionResults results={results} onClear={handleReset} />
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Private & Secure</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              All conversions happen directly in your browser. Your images never leave your device.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Lightning Fast</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Optimized for speed with instant processing and no server uploads required.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Bulk Convert</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Process multiple images at once with consistent quality settings and easy downloads.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            Built with modern web technologies. No uploads, no tracking, no limits.
          </p>
        </div>
      </footer>
    </div>
  );
}
