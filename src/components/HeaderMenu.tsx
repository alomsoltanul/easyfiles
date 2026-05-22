'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ConversionFormat } from '@/lib/converters';
import { ResizePreset, RESIZE_PRESETS } from './CompressionSettings';

interface HeaderMenuProps {
  activeTab: ConversionFormat;
  onTabChange: (tab: ConversionFormat) => void;
  mode: 'single' | 'bulk';
  onModeChange: (mode: 'single' | 'bulk') => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  maxWidth: ResizePreset;
  onMaxWidthChange: (preset: ResizePreset) => void;
  filesCount: number;
  isConverting: boolean;
  progress: number;
  resultsCount: number;
  onConvert: () => void;
  onReset: () => void;
  onDownloadAll?: () => void;
}

const TABS: { id: ConversionFormat; label: string; shortLabel: string }[] = [
  { id: 'png-to-webp', label: 'PNG to WebP', shortLabel: 'PNG' },
  { id: 'jpg-to-webp', label: 'JPG to WebP', shortLabel: 'JPG' },
  { id: 'heic-to-webp', label: 'HEIC to WebP', shortLabel: 'HEIC' },
];

export default function HeaderMenu({
  activeTab,
  onTabChange,
  mode,
  onModeChange,
  quality,
  onQualityChange,
  maxWidth,
  onMaxWidthChange,
  filesCount,
  isConverting,
  progress,
  resultsCount,
  onConvert,
  onReset,
  onDownloadAll,
}: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasFiles = filesCount > 0;
  const hasResults = resultsCount > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all duration-200 shadow-sm"
        aria-label="Settings menu"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-semibold hidden sm:inline">Options</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 overflow-hidden">
          {/* Format Section */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Input Format</h3>
            <div className="grid grid-cols-3 gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id);
                  }}
                  className={`
                    px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                    ${activeTab === tab.id
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >
                  {tab.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Section */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Convert Mode</h3>
            <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
              <button
                onClick={() => onModeChange('single')}
                className={`
                  flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                  ${mode === 'single'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
              >
                Single
              </button>
              <button
                onClick={() => onModeChange('bulk')}
                className={`
                  flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                  ${mode === 'bulk'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
              >
                Bulk
              </button>
            </div>
          </div>

          {/* Quality Section */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Quality</h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {quality}%
              </span>
            </div>
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
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1.5">
              <span>Smallest</span>
              <span>Highest</span>
            </div>
          </div>

          {/* Max Dimensions Section */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Max Dimensions</h3>
            <div className="grid grid-cols-3 gap-2">
              {RESIZE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onMaxWidthChange(preset.value)}
                  className={`
                    relative px-2 py-2 rounded-lg text-[10px] font-semibold text-center transition-all duration-200 border leading-tight
                    ${maxWidth === preset.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >
                  {preset.label}
                  {preset.value === '1024' && (
                    <span className={`absolute -top-1.5 -right-1.5 text-[8px] font-bold px-1 py-0.5 rounded-full ${maxWidth === '1024' ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      Best
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div className="p-4 bg-slate-50/50 space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</h3>

            {hasResults && onDownloadAll && (
              <button
                onClick={() => {
                  onDownloadAll();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 text-sm shadow-sm shadow-emerald-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download All ({resultsCount})
              </button>
            )}

            {hasFiles && !hasResults && (
              <>
                {isConverting ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Converting {filesCount} file{filesCount !== 1 ? 's' : ''}...</span>
                      <span className="text-emerald-600">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onConvert();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 text-sm shadow-sm shadow-emerald-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Convert to WebP
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => {
                onReset();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl transition-all duration-200 text-sm border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>

          {/* Status Footer */}
          <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>{hasFiles && !hasResults ? `${filesCount} file${filesCount !== 1 ? 's' : ''} ready` : hasResults ? `${resultsCount} converted` : 'No files selected'}</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {mode === 'bulk' ? 'Bulk mode' : 'Single mode'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
