'use client';

import React from 'react';

export type ResizePreset = 'original' | '2048' | '1920' | '1536' | '1024' | '512';

export const RESIZE_PRESETS: { value: ResizePreset; label: string; description: string }[] = [
  { value: 'original', label: 'Original Size', description: 'Keep original dimensions' },
  { value: '2048', label: '2048px', description: 'Large screens' },
  { value: '1920', label: '1920px', description: 'Full HD' },
  { value: '1536', label: '1536px', description: 'Retina displays' },
  { value: '1024', label: '1024px', description: 'Best for Supabase' },
  { value: '512', label: '512px', description: 'Thumbnails / Icons' },
];

interface CompressionSettingsProps {
  quality: number;
  onQualityChange: (quality: number) => void;
  maxWidth: ResizePreset;
  onMaxWidthChange: (preset: ResizePreset) => void;
}

export default function CompressionSettings({
  quality,
  onQualityChange,
  maxWidth,
  onMaxWidthChange,
}: CompressionSettingsProps) {
  const isSupabaseOptimal = maxWidth === '1024' && quality >= 60 && quality <= 75;

  return (
    <div className="space-y-8">
      {/* Resize / Max Width */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Max Dimensions</label>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Keeps aspect ratio
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {RESIZE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onMaxWidthChange(preset.value)}
              className={`
                relative px-3 py-2.5 rounded-xl text-xs font-semibold text-center transition-all duration-200 border
                ${maxWidth === preset.value
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <div className="leading-tight">{preset.label}</div>
              <div className={`text-[10px] mt-1 font-medium ${maxWidth === preset.value ? 'text-slate-300' : 'text-slate-400'}`}>
                {preset.description}
              </div>
              {preset.value === '1024' && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${maxWidth === '1024' ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  Best
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Output Quality</label>
          <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {quality}%
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min="10"
            max="100"
            value={quality}
            onChange={(e) => onQualityChange(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${quality}%, #e2e8f0 ${quality}%, #e2e8f0 100%)`,
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>Smallest File</span>
          <span>Highest Quality</span>
        </div>
      </div>

      {/* Tip */}
      <div
        className={`
          rounded-xl p-4 text-xs border transition-colors duration-200
          ${isSupabaseOptimal
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-slate-50 border-slate-200 text-slate-600'
          }
        `}
      >
        <div className="flex items-start gap-2.5">
          <svg
            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSupabaseOptimal ? 'text-emerald-600' : 'text-slate-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="leading-relaxed">
            {isSupabaseOptimal ? (
              <>
                <span className="font-bold">Supabase Optimized!</span> This combo gives the best balance for fast
                storage uploads and quick loading.
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-700">Supabase Tip:</span> Set dimensions to{' '}
                <span className="font-bold">1024px</span> and quality to{' '}
                <span className="font-bold">60–75%</span> for the fastest upload and smallest file size while keeping
                great visual quality.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
