'use client';

import React from 'react';

export type InputFormat = 'heic' | 'jpeg' | 'png' | 'webp';
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

const OUTPUT_OPTIONS: { value: OutputFormat; label: string; ext: string }[] = [
  { value: 'image/jpeg', label: 'JPEG', ext: '.jpg' },
  { value: 'image/png', label: 'PNG', ext: '.png' },
  { value: 'image/webp', label: 'WebP', ext: '.webp' },
];

interface FormatSelectorProps {
  inputFormat: InputFormat | null;
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
}

export function getInputFormatLabel(format: InputFormat): string {
  switch (format) {
    case 'heic': return 'HEIC';
    case 'jpeg': return 'JPEG';
    case 'png': return 'PNG';
    case 'webp': return 'WebP';
  }
}

export function getInputFormatMime(format: InputFormat): string {
  switch (format) {
    case 'heic': return '.heic,.heif,image/heic,image/heif';
    case 'jpeg': return '.jpg,.jpeg,image/jpeg,image/jpg';
    case 'png': return '.png,image/png';
    case 'webp': return '.webp,image/webp';
  }
}

export function detectInputFormat(file: File): InputFormat | null {
  const name = file.name.toLowerCase();
  if (file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) return 'heic';
  if (file.type === 'image/jpeg' || file.type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpeg';
  if (file.type === 'image/png' || name.endsWith('.png')) return 'png';
  if (file.type === 'image/webp' || name.endsWith('.webp')) return 'webp';
  return null;
}

export default function FormatSelector({ inputFormat, outputFormat, onOutputFormatChange }: FormatSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        {inputFormat ? (
          <>
            <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {getInputFormatLabel(inputFormat)}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </>
        ) : (
          <span className="font-medium text-slate-500">Any format →</span>
        )}
        <span className="text-xs font-medium text-slate-400">Convert to:</span>
      </div>
      <div className="flex gap-2">
        {OUTPUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onOutputFormatChange(opt.value)}
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
  );
}

export function getOutputExtension(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
  }
}
