'use client';

import React, { useCallback, useRef, useState } from 'react';

interface Props {
  accept: string;
  acceptLabel: string; // e.g. "PDF files accepted"
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  onFiles: (files: File[]) => void;
  onFile?: (file: File) => void;
  filter?: (file: File) => boolean;
}

const GDRIVE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.71 3.5l-6 10.39L4.29 18.5l6-10.39L7.71 3.5z" fill="#0F9D58" />
    <path d="M22.29 13.89L16.29 3.5H10.71l6 10.39h5.58z" fill="#F4B400" />
    <path d="M4.29 18.5L2.71 21h13l3-5.11H7.29z" fill="#4285F4" />
  </svg>
);

const DROPBOX_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 3L1 6.5 6.5 10 12 6.5 6.5 3z" fill="#0061FF" />
    <path d="M17.5 3L12 6.5 17.5 10 23 6.5 17.5 3z" fill="#0061FF" />
    <path d="M1 13.5L6.5 17 12 13.5 6.5 10 1 13.5z" fill="#0061FF" />
    <path d="M17.5 10L12 13.5 17.5 17 23 13.5 17.5 10z" fill="#0061FF" />
    <path d="M6.5 18.25L12 21.75l5.5-3.5L12 14.75l-5.5 3.5z" fill="#0061FF" />
  </svg>
);

export default function UploadSection({
  accept,
  acceptLabel,
  multiple = false,
  title = 'Drop your file here',
  subtitle = 'or click to browse',
  onFiles,
  onFile,
  filter,
}: Props) {
  const [hover, setHover] = useState(false);
  const [comingSoon, setComingSoon] = useState<'gdrive' | 'dropbox' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    const kept = filter ? arr.filter(filter) : arr;
    if (kept.length === 0) return;
    onFiles(kept);
    if (onFile && kept[0]) onFile(kept[0]);
  }, [onFile, onFiles, filter]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 bg-white ${
          hover
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01] shadow-lg'
            : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
        <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mb-6 shadow-inner">
          <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm sm:text-base mb-6">{subtitle}</p>
        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-xs font-semibold px-4 py-2 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {acceptLabel}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 h-px bg-slate-200"></div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or import from</span>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setComingSoon('gdrive')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all text-sm font-semibold text-slate-700"
        >
          {GDRIVE_ICON}
          Google Drive
        </button>
        <button
          type="button"
          onClick={() => setComingSoon('dropbox')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all text-sm font-semibold text-slate-700"
        >
          {DROPBOX_ICON}
          Dropbox
        </button>
      </div>

      {comingSoon && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
          </svg>
          <div className="flex-1 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">
              {comingSoon === 'gdrive' ? 'Google Drive' : 'Dropbox'} integration coming soon.
            </span>{' '}
            For now, download the file to your device and use local upload above.
          </div>
          <button onClick={() => setComingSoon(null)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
