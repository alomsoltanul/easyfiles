'use client';

import React from 'react';
import { formatFileSize } from '@/lib/converters';

interface SizeComparisonProps {
  originalSize: number;
  convertedSize: number;
  label?: string;
}

export default function SizeComparison({ originalSize, convertedSize, label }: SizeComparisonProps) {
  const savingsPercent = originalSize > 0
    ? Math.round(((originalSize - convertedSize) / originalSize) * 100)
    : 0;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      {label && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>}
      <div className="flex items-center gap-4">
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-slate-400">{formatFileSize(originalSize)}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase">Original</p>
        </div>
        <svg className="w-5 h-5 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-emerald-600">{formatFileSize(convertedSize)}</p>
          <p className="text-[10px] text-emerald-600 font-medium uppercase">Converted</p>
        </div>
      </div>
      {savingsPercent !== 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 text-center">
          <span className={`text-xs font-bold ${savingsPercent > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {savingsPercent > 0 ? `${savingsPercent}% smaller` : `${Math.abs(savingsPercent)}% larger`}
          </span>
        </div>
      )}
    </div>
  );
}
