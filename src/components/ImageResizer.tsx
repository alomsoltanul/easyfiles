'use client';

import React, { useState, useCallback } from 'react';
import { downloadImage, formatFileSize } from '@/lib/converters';
import UploadZone from './UploadZone';
import SizeComparison from './SizeComparison';

type ResizePreset = { width: number; height: number; label: string };

const PRESETS: ResizePreset[] = [
  { width: 1080, height: 1080, label: 'Instagram Post' },
  { width: 1080, height: 1920, label: 'Story / Reel' },
  { width: 1600, height: 900, label: 'Twitter Post' },
  { width: 320, height: 240, label: 'Thumbnail' },
  { width: 800, height: 600, label: 'Email' },
];

export default function ImageResizer() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [locked, setLocked] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; fileName: string; originalSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origDims, setOrigDims] = useState<{ width: number; height: number } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    const f = files[0];
    setFile(f);
    setResult(null);
    setError(null);

    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      setOrigDims({ width: img.width, height: img.height });
      setWidth(img.width);
      setHeight(img.height);
    };
    img.src = url;
  }, []);

  const handlePreset = useCallback((preset: ResizePreset) => {
    setWidth(preset.width);
    setHeight(preset.height);
  }, []);

  const handleWidthChange = useCallback((w: number) => {
    setWidth(w);
    if (locked && origDims) {
      const ratio = origDims.height / origDims.width;
      setHeight(Math.round(w * ratio));
    }
  }, [locked, origDims]);

  const handleHeightChange = useCallback((h: number) => {
    setHeight(h);
    if (locked && origDims) {
      const ratio = origDims.width / origDims.height;
      setWidth(Math.round(h * ratio));
    }
  }, [locked, origDims]);

  const handleResize = useCallback(async () => {
    if (!file) return;
    setIsConverting(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
      });

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const ext = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const mimeExt = ext === 'image/png' ? 'png' : 'jpg';

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('Failed to create blob')); }, ext, 0.9);
      });

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setResult({ blob, fileName: `${baseName}-resized.${mimeExt}`, originalSize: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resize failed.');
    } finally {
      setIsConverting(false);
    }
  }, [file, width, height]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setOrigDims(null);
  }, []);

  return (
    <div className="space-y-8">
      {!file ? (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upload Image</h2>
          <UploadZone mode="single" onFilesSelected={handleFileSelected} acceptAllImages label="Drop an image to resize" description="or click to browse" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700">Change</button>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Dimensions</h2>
              <button
                onClick={() => setLocked(!locked)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${locked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {locked ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                )}
                {locked ? 'Locked' : 'Unlocked'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Width (px)</label>
                <input type="number" value={width} onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Height (px)</label>
                <input type="number" value={height} onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${width === preset.width && height === preset.height ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  {preset.label} ({preset.width}×{preset.height})
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>
          )}

          {!result && (
            <div className="border-t border-slate-100 pt-6">
              <button
                onClick={handleResize}
                disabled={isConverting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
              >
                {isConverting ? 'Resizing...' : `Resize to ${width}×${height}`}
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Resized!</h2>
                  <p className="text-sm text-slate-500">{result.fileName}</p>
                </div>
              </div>
              <SizeComparison originalSize={result.originalSize} convertedSize={result.blob.size} />
              <div className="flex gap-3">
                <button
                  onClick={() => downloadImage(result.blob, result.fileName)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
                <button onClick={handleReset} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">Resize Another</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
