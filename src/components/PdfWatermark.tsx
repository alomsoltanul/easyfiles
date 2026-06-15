'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';

export default function PdfWatermark() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState('center');
  const [size, setSize] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const pickRef = useRef<HTMLInputElement>(null);
  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'watermark',
    options: {
      text: watermarkType === 'text' ? text : undefined,
      imagePath: watermarkType === 'image' ? imageFile?.name : undefined,
      opacity,
      rotation,
      position,
      size,
    },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    reset();
  }, [reset]);

  const handleImageFile = useCallback((f: File) => {
    setImageFile(f);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    const files = [file];
    if (imageFile) files.push(imageFile);
    await process(files);
  }, [file, imageFile, process]);

  const handleReset = useCallback(() => {
    setFile(null);
    setImageFile(null);
    setText('');
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
                <h2 className="text-lg font-bold text-slate-800 mb-3">Watermark Type</h2>
                <div className="flex gap-2">
                  <button onClick={() => setWatermarkType('text')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${watermarkType === 'text' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    Text
                  </button>
                  <button onClick={() => setWatermarkType('image')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${watermarkType === 'image' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    Image
                  </button>
                </div>
              </div>

              {watermarkType === 'text' ? (
                <div className="border-t border-slate-100 pt-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-3">Watermark Text</h2>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter watermark text"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm"
                  />
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-3">Watermark Image</h2>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/')); if (f) handleImageFile(f); }}
                    onClick={() => pickRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer transition-all hover:border-emerald-400 hover:bg-emerald-50/30 bg-white"
                  >
                      <input ref={pickRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} className="hidden" />
                    {imageFile ? (
                      <p className="text-sm font-medium text-slate-800">{imageFile.name}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Drop image or click to browse</p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Opacity: {Math.round(opacity * 100)}%</label>
                  <input type="range" min="0" max="100" value={opacity * 100} onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                    className="w-full" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Rotation: {rotation}°</label>
                  <input type="range" min="0" max="360" value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Position</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].map(pos => (
                      <button key={pos} onClick={() => setPosition(pos)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${position === pos ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {pos.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                {watermarkType === 'text' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Size: {size}px</label>
                    <input type="range" min="10" max="100" value={size} onChange={(e) => setSize(Number(e.target.value))}
                      className="w-full" />
                  </div>
                )}
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button onClick={handleProcess} disabled={isProcessing || !text && !imageFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                  {isProcessing ? 'Processing...' : 'Add Watermark'}
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
                  <h2 className="text-lg font-bold text-slate-800">Watermark Added!</h2>
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
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Watermark Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
