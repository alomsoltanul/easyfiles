'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { usePdfTool } from '@/hooks/usePdfTool';
import { formatFileSize } from '@/lib/converters';
import UploadSection from './UploadSection';
import PdfPreview from './PdfPreview';

interface Props {
  toolType:
    | 'word-to-pdf'
    | 'excel-to-pdf'
    | 'powerpoint-to-pdf'
    | 'pdf-to-word'
    | 'pdf-to-excel'
    | 'pdf-to-powerpoint';
  accept: string;
  acceptLabel: string;
  uploadTitle: string;
  uploadSubtitle: string;
  actionLabel: string; // e.g. "Convert to PDF"
  successTitle: string;
  filterExt: string; // e.g. ".docx,.doc" — comma-separated extensions
  showPdfPreview?: boolean;
}

export default function DocConverter({
  toolType,
  accept,
  acceptLabel,
  uploadTitle,
  uploadSubtitle,
  actionLabel,
  successTitle,
  filterExt,
  showPdfPreview,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const { isProcessing, progress, result, error, process, download, reset } = usePdfTool({ toolType });

  const extRegex = useMemo(() => {
    const exts = filterExt.split(',').map((s) => s.trim().replace(/^\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\.(${exts.join('|')})$`, 'i');
  }, [filterExt]);

  const handleFiles = useCallback((files: File[]) => {
    const f = files.find((x) => extRegex.test(x.name)) ?? files[0];
    if (!f) return;
    setFile(f);
    reset();
  }, [reset, extRegex]);

  const handleAction = useCallback(async () => {
    if (!file) return;
    await process([file]);
  }, [file, process]);

  const handleReset = useCallback(() => {
    setFile(null);
    reset();
  }, [reset]);

  return (
    <div className="space-y-8">
      {!file ? (
        <UploadSection
          accept={accept}
          acceptLabel={acceptLabel}
          title={uploadTitle}
          subtitle={uploadSubtitle}
          onFiles={handleFiles}
          filter={(f) => extRegex.test(f.name)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700">Change</button>
          </div>

          {showPdfPreview && <PdfPreview file={file} />}

          {!result && (
            <>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">{error}</div>}

              <div className="border-t border-slate-100 pt-6">
                <button
                  onClick={handleAction}
                  disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200"
                >
                  {isProcessing ? `Converting... ${progress}%` : actionLabel}
                </button>
                <p className="text-xs text-slate-400 text-center mt-3">
                  Everything runs in your browser — nothing is uploaded to any server.
                </p>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{successTitle}</h2>
                  <p className="text-sm text-slate-500">{result.name}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{result.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(result.size)}</p>
                </div>
                <button
                  onClick={download}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
              <button onClick={handleReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">
                Convert Another
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
