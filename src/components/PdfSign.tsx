'use client';

import React, { useState, useCallback, useRef } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = '#1e2a5e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange(canvasRef.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={560}
        height={180}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full bg-white border border-slate-200 rounded-xl touch-none cursor-crosshair"
      />
      <button onClick={clear} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700">
        Clear signature
      </button>
    </div>
  );
}

export default function PdfSign() {
  const [file, setFile] = useState<File | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type' | 'upload'>('type');
  const [signatureText, setSignatureText] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isProcessing, result, error, process, download, reset } = usePdfTool({
    toolType: 'sign',
    options: {
      signatureType,
      signatureData: signatureType === 'type' ? signatureText : signatureImage || '',
    },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    reset();
  }, [reset]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setSignatureImage(reader.result as string);
      reader.readAsDataURL(f);
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    const files = [file];
    await process(files);
  }, [file, process]);

  const handleReset = useCallback(() => {
    setFile(null);
    setSignatureText('');
    setSignatureImage(null);
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
                <h2 className="text-lg font-bold text-slate-800 mb-3">Signature Type</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setSignatureType('type'); setSignatureImage(null); }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${signatureType === 'type' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    Type
                  </button>
                  <button onClick={() => { setSignatureType('draw'); setSignatureImage(null); }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${signatureType === 'draw' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    Draw
                  </button>
                  <button onClick={() => { setSignatureType('upload'); setSignatureImage(null); }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${signatureType === 'upload' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    Upload Image
                  </button>
                </div>
              </div>

              {signatureType === 'type' && (
                <div className="border-t border-slate-100 pt-6">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Signature Text</label>
                  <input
                    type="text"
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    placeholder="Enter your signature"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-cursive"
                  />
                </div>
              )}
              {signatureType === 'draw' && (
                <div className="border-t border-slate-100 pt-6">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Draw Your Signature</label>
                  <SignaturePad onChange={setSignatureImage} />
                </div>
              )}
              {signatureType === 'upload' && (
                <div className="border-t border-slate-100 pt-6">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Signature Image</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-slate-600" />
                  {signatureImage && (
                    <img src={signatureImage} alt="Signature preview" className="mt-3 max-h-24 rounded-lg border border-slate-200" />
                  )}
                </div>
              )}

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button onClick={handleProcess} disabled={isProcessing || (!signatureText && !signatureImage)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200">
                  {isProcessing ? 'Processing...' : 'Sign PDF'}
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
                  <h2 className="text-lg font-bold text-slate-800">PDF Signed!</h2>
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
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">Sign Another</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
