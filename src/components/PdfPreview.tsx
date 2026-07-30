'use client';

import React, { useEffect, useState } from 'react';
import { renderPDFPage, getPDFPageCount } from '@/lib/pdf-render';

interface Props {
  file: File;
  label?: string;
}

interface PreviewState {
  file: File;
  thumb: string | null;
  pages: number | null;
  error: boolean;
}

export default function PdfPreview({ file, label }: Props) {
  const [state, setState] = useState<PreviewState>({ file, thumb: null, pages: null, error: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [img, count] = await Promise.all([
          renderPDFPage(file, 1, 1),
          getPDFPageCount(file),
        ]);
        if (!cancelled) setState({ file, thumb: img, pages: count, error: false });
      } catch {
        if (!cancelled) setState({ file, thumb: null, pages: null, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const current = state.file === file ? state : { thumb: null, pages: null, error: false };
  const { thumb, pages, error } = current;

  return (
    <div className="border-t border-slate-100 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{label ?? 'Preview'}</h3>
        {pages !== null && <span className="text-xs text-slate-500">{pages} page{pages !== 1 ? 's' : ''}</span>}
      </div>
      <div className="flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
        {error ? (
          <div className="py-8 text-sm text-slate-500">Preview unavailable</div>
        ) : thumb ? (
          <img src={thumb} alt="First page preview" className="max-h-64 w-auto rounded-lg shadow-sm border border-slate-200 bg-white" />
        ) : (
          <div className="py-8 flex items-center gap-2 text-sm text-slate-500">
            <span className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
            Loading preview...
          </div>
        )}
      </div>
    </div>
  );
}
