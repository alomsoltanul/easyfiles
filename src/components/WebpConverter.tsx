'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { convertBulkToWebp, supportsWebpEncode, WebpBulkResult, WebpBulkFailure } from '@/lib/webp';
import { formatFileSize, downloadImage } from '@/lib/converters';

type Source = 'png' | 'jpeg';

interface SourceSpec {
  label: string;
  accept: string;
  matches: (file: File) => boolean;
  supportsAlpha: boolean;
}

const SOURCES: Record<Source, SourceSpec> = {
  png: {
    label: 'PNG',
    accept: '.png,image/png',
    matches: (f) => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'),
    supportsAlpha: true,
  },
  jpeg: {
    label: 'JPEG',
    accept: '.jpg,.jpeg,.jfif,image/jpeg,image/jpg',
    matches: (f) =>
      f.type === 'image/jpeg' ||
      f.type === 'image/jpg' ||
      /\.(jpg|jpeg|jfif)$/.test(f.name.toLowerCase()),
    supportsAlpha: false,
  },
};

const QUALITY_PRESETS = [
  { value: 100, label: 'Maximum', hint: 'Archival' },
  { value: 92, label: 'High', hint: 'Recommended' },
  { value: 80, label: 'Balanced', hint: 'Web pages' },
  { value: 65, label: 'Small', hint: 'Thumbnails' },
];

const SIZE_PRESETS: { value: string; label: string; hint: string }[] = [
  { value: 'original', label: 'Original', hint: 'No resize' },
  { value: '3840', label: '3840px', hint: '4K' },
  { value: '2560', label: '2560px', hint: 'Retina' },
  { value: '1920', label: '1920px', hint: 'Full HD' },
  { value: '1280', label: '1280px', hint: 'Web' },
  { value: '800', label: '800px', hint: 'Thumbs' },
];

interface WebpConverterProps {
  source: Source;
}

export default function WebpConverter({ source }: WebpConverterProps) {
  const spec = SOURCES[source];

  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(92);
  const [lossless, setLossless] = useState(false);
  const [preserveTransparency, setPreserveTransparency] = useState(spec.supportsAlpha);
  const [maxDimension, setMaxDimension] = useState('original');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<WebpBulkResult[] | null>(null);
  const [failures, setFailures] = useState<WebpBulkFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [encodeSupported, setEncodeSupported] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEncodeSupported(supportsWebpEncode());
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    const accepted = incoming.filter(spec.matches);
    const rejected = incoming.length - accepted.length;
    if (accepted.length === 0) {
      setError(`Please choose ${spec.label} files.`);
      return;
    }
    setError(rejected > 0 ? `${rejected} non-${spec.label} file${rejected !== 1 ? 's were' : ' was'} skipped.` : null);
    setResults(null);
    setFailures([]);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
      return [...prev, ...accepted.filter((f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`))];
    });
  }, [spec]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50');
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setFailures([]);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
      const { results: converted, failures: failed } = await convertBulkToWebp(
        files,
        {
          quality: quality / 100,
          lossless: spec.supportsAlpha && lossless,
          maxDimension: maxDimension === 'original' ? undefined : parseInt(maxDimension, 10),
          preserveTransparency: spec.supportsAlpha && preserveTransparency,
        },
        (completed, total) => setProgress(Math.round((completed / total) * 100))
      );

      setFailures(failed);
      if (converted.length === 0) {
        throw new Error(failed[0]?.reason || 'No files could be converted.');
      }
      setResults(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
    } finally {
      setIsConverting(false);
    }
  }, [files, quality, lossless, maxDimension, preserveTransparency, spec]);

  const handleDownloadZip = useCallback(async () => {
    if (!results) return;
    setZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const result of results) {
        // Two source folders can hold the same basename — de-dupe inside the zip.
        const count = used.get(result.fileName) ?? 0;
        used.set(result.fileName, count + 1);
        const name = count === 0 ? result.fileName : result.fileName.replace(/\.webp$/, `-${count}.webp`);
        zip.file(name, result.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadImage(blob, `${spec.label.toLowerCase()}-to-webp.zip`);
    } catch {
      setError('Could not build the ZIP. Download the files individually instead.');
    } finally {
      setZipping(false);
    }
  }, [results, spec]);

  const totals = useMemo(() => {
    if (!results) return null;
    const original = results.reduce((sum, r) => sum + r.originalSize, 0);
    const converted = results.reduce((sum, r) => sum + r.convertedSize, 0);
    return {
      original,
      converted,
      savedPercent: original > 0 ? Math.round(((original - converted) / original) * 100) : 0,
      transparent: results.filter((r) => r.hadAlpha).length,
    };
  }, [results]);

  const totalInputSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  return (
    <div className="space-y-8">
      {!encodeSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium">
          This browser can&apos;t encode WebP. Use Chrome, Edge, Firefox, or Safari 16+.
        </div>
      )}

      {!results && (
        <>
          {/* Upload */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {files.length === 0 ? `Upload ${spec.label} Images` : 'Add More Images'}
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {spec.label} → WEBP
              </span>
            </div>

            <div
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault();
                dropRef.current?.classList.add('border-emerald-500', 'bg-emerald-50/50');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                dropRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50');
              }}
              onDrop={handleDrop}
              onClick={() => !isConverting && fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                transition-all duration-300 ease-out
                ${isConverting
                  ? 'border-slate-200 bg-slate-50/50 cursor-not-allowed opacity-60'
                  : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-lg'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={spec.accept}
                multiple
                disabled={isConverting}
                onChange={(e) => {
                  if (e.target.files) addFiles(Array.from(e.target.files));
                }}
                className="hidden"
              />
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    Drop your {spec.label} files here
                  </h3>
                  <p className="text-slate-500 text-sm mb-3">or click to browse — batch conversion supported</p>
                  <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {spec.label} only
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">
                  {files.length} File{files.length !== 1 ? 's' : ''}
                </h2>
                <span className="text-xs font-medium text-slate-500">{formatFileSize(totalInputSize)} total</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={`${file.name}-${file.lastModified}-${i}`} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
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

          {/* Settings */}
          {files.length > 0 && (
            <div className="border-t border-slate-100 pt-6 space-y-8">
              <h2 className="text-lg font-bold text-slate-800">Quality Settings</h2>

              {spec.supportsAlpha && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setLossless(!lossless)}
                    className={`flex items-start gap-3 text-left px-4 py-3.5 rounded-xl border transition-all ${
                      lossless ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      lossless ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                    }`}>
                      {lossless && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Lossless WebP</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Pixel-perfect copy of the PNG — still ~26% smaller. Best for logos, screenshots, and line art.
                      </span>
                    </span>
                  </button>

                  <button
                    onClick={() => setPreserveTransparency(!preserveTransparency)}
                    className={`flex items-start gap-3 text-left px-4 py-3.5 rounded-xl border transition-all ${
                      preserveTransparency ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      preserveTransparency ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                    }`}>
                      {preserveTransparency && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Keep transparency</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Preserves the alpha channel. Turn off to flatten onto a white background.
                      </span>
                    </span>
                  </button>
                </div>
              )}

              {/* Quality */}
              <div className={`space-y-4 transition-opacity ${lossless ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Output Quality</label>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    {lossless ? 'Lossless' : `${quality}%`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUALITY_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setQuality(preset.value)}
                      className={`relative px-3 py-2.5 rounded-xl text-xs font-semibold text-center transition-all duration-200 border ${
                        quality === preset.value
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="leading-tight">{preset.label}</div>
                      <div className={`text-[10px] mt-1 font-medium ${quality === preset.value ? 'text-slate-300' : 'text-slate-400'}`}>
                        {preset.hint}
                      </div>
                      {preset.value === 92 && (
                        <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          quality === 92 ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          Best
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${quality}%, #e2e8f0 ${quality}%, #e2e8f0 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Smallest File</span>
                  <span>Highest Quality</span>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Max Dimensions</label>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    Keeps aspect ratio
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setMaxDimension(preset.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-center transition-all duration-200 border ${
                        maxDimension === preset.value
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="leading-tight">{preset.label}</div>
                      <div className={`text-[10px] mt-1 font-medium ${maxDimension === preset.value ? 'text-slate-300' : 'text-slate-400'}`}>
                        {preset.hint}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    Resizing uses stepped resampling, so downscaled text and edges stay sharp.{' '}
                    {source === 'jpeg'
                      ? 'JPEG EXIF orientation is applied automatically, so portrait photos stay upright.'
                      : 'The alpha channel survives the resize when transparency is kept.'}
                  </div>
                </div>
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
                    <span>Converting {files.length} {spec.label} file{files.length !== 1 ? 's' : ''}...</span>
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
                    disabled={!encodeSupported}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200"
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
        </>
      )}

      {results && totals && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Conversion Complete!</h2>
              <p className="text-sm text-slate-500">
                {results.length} WebP file{results.length !== 1 ? 's' : ''} ready
                {totals.transparent > 0 ? ` — transparency preserved on ${totals.transparent}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Files" value={String(results.length)} tone="slate" />
            <Stat label="Before" value={formatFileSize(totals.original)} tone="slate" />
            <Stat label="After" value={formatFileSize(totals.converted)} tone="emerald" />
            <Stat
              label="Saved"
              value={totals.savedPercent > 0 ? `-${totals.savedPercent}%` : `+${Math.abs(totals.savedPercent)}%`}
              tone="amber"
            />
          </div>

          {failures.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
              <p className="font-semibold mb-1">{failures.length} file{failures.length !== 1 ? 's' : ''} failed</p>
              <ul className="text-xs space-y-0.5">
                {failures.map((f) => (
                  <li key={f.fileName}>{f.fileName} — {f.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">WebP Files</h3>
              <button
                onClick={handleDownloadZip}
                disabled={zipping}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {zipping ? 'Building ZIP...' : 'Download All (ZIP)'}
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <ResultRow key={`${result.fileName}-${index}`} result={result} />
              ))}
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200"
          >
            Convert More Images
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'amber' }) {
  const tones = {
    slate: 'bg-slate-50 border-slate-100 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
  };
  return (
    <div className={`rounded-xl p-4 border text-center ${tones[tone]}`}>
      <p className="text-xl font-bold truncate">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide mt-1 opacity-70">{label}</p>
    </div>
  );
}

function ResultRow({ result }: { result: WebpBulkResult }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result.blob]);

  const saved = result.originalSize > 0
    ? Math.round(((result.originalSize - result.convertedSize) / result.originalSize) * 100)
    : 0;

  return (
    <div className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
      <div
        className="w-12 h-12 rounded-lg border border-slate-200 flex-shrink-0 overflow-hidden bg-[length:12px_12px] bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[position:0_0,0_6px,6px_-6px,-6px_0]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={result.fileName} className="w-full h-full object-cover" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{result.fileName}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{result.width}×{result.height}</span>
          <span>{formatFileSize(result.originalSize)} → {formatFileSize(result.convertedSize)}</span>
          <span className={`font-semibold ${saved > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {saved > 0 ? `-${saved}%` : `+${Math.abs(saved)}%`}
          </span>
          {result.hadAlpha && (
            <span className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">alpha</span>
          )}
        </div>
      </div>

      <button
        onClick={() => downloadImage(result.blob, result.fileName)}
        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
        title="Download"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
}
