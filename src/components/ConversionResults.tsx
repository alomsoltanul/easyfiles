'use client';

import React from 'react';
import { ConversionResult, formatFileSize, downloadImage } from '@/lib/converters';

interface ConversionResultsProps {
  results: ConversionResult[];
  onClear: () => void;
}

export default function ConversionResults({ results, onClear }: ConversionResultsProps) {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalConverted = results.reduce((sum, r) => sum + r.convertedSize, 0);
  const savingsPercent = totalOriginal > 0 
    ? Math.round(((totalOriginal - totalConverted) / totalOriginal) * 100) 
    : 0;

  const handleDownloadAll = () => {
    results.forEach((result, index) => {
      setTimeout(() => {
        downloadImage(result.convertedBlob, result.fileName);
      }, index * 200);
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">{results.length}</p>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Files</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
          <p className="text-2xl font-bold text-emerald-700">{formatFileSize(totalConverted)}</p>
          <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mt-1">Total Size</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
          <p className="text-2xl font-bold text-amber-700">
            {savingsPercent > 0 ? `-${savingsPercent}%` : `${savingsPercent}%`}
          </p>
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Saved</p>
        </div>
      </div>

      {/* File List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Converted Files</h3>
          <button
            onClick={handleDownloadAll}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download All
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {results.map((result, index) => {
            const itemSavings = result.originalSize > 0 
              ? Math.round(((result.originalSize - result.convertedSize) / result.originalSize) * 100)
              : 0;

            return (
              <div key={index} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{result.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{result.width}×{result.height}</span>
                    <span>{formatFileSize(result.originalSize)} → {formatFileSize(result.convertedSize)}</span>
                    <span className={`font-semibold ${itemSavings > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {itemSavings > 0 ? `-${itemSavings}%` : `+${Math.abs(itemSavings)}%`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => downloadImage(result.convertedBlob, result.fileName)}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  title="Download"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onClear}
        className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors duration-200"
      >
        Convert More Images
      </button>
    </div>
  );
}
