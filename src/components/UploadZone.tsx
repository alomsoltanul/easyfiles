'use client';

import React, { useRef, useCallback } from 'react';
import { ConversionFormat, getAcceptedTypes, validateFileType, getFormatLabel } from '@/lib/converters';

interface UploadZoneProps {
  format: ConversionFormat;
  mode: 'single' | 'bulk';
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ format, mode, onFilesSelected, disabled }: UploadZoneProps) {
  const dragDropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropRef.current?.classList.add('border-emerald-500', 'bg-emerald-50/50');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropRef.current?.classList.remove('border-emerald-500', 'bg-emerald-50/50');

    const files = Array.from(e.dataTransfer.files).filter(file => validateFileType(file, format));
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [format, onFilesSelected]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(file => validateFileType(file, format));
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  }, [format, onFilesSelected]);

  const acceptedTypes = getAcceptedTypes(format);
  const formatLabel = getFormatLabel(format);

  return (
    <div
      ref={dragDropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
        transition-all duration-300 ease-out
        ${disabled 
          ? 'border-slate-200 bg-slate-50/50 cursor-not-allowed opacity-60' 
          : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-lg'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInputChange}
        accept={acceptedTypes}
        multiple={mode === 'bulk'}
        disabled={disabled}
        className="hidden"
      />

      <div className="space-y-4">
        <div className={`
          mx-auto w-20 h-20 rounded-2xl flex items-center justify-center
          ${disabled ? 'bg-slate-100' : 'bg-emerald-50'}
          transition-colors duration-300
        `}>
          <svg
            className={`w-10 h-10 ${disabled ? 'text-slate-300' : 'text-emerald-500'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            {mode === 'bulk' ? 'Drop your images here' : 'Drop your image here'}
          </h3>
          <p className="text-slate-500 text-sm mb-3">or click to browse</p>
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {formatLabel} {mode === 'bulk' ? 'files' : 'file'} accepted
          </div>
        </div>
      </div>
    </div>
  );
}
