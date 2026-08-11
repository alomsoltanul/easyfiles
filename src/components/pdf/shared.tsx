'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatFileSize } from '@/lib/converters';
import { renderPDFPage } from '@/lib/pdf-render';

/* ------------------------------------------------------------------ upload */

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
}

export function Dropzone({
  onFiles,
  accept = '.pdf,application/pdf',
  multiple = false,
  title = 'Drop your PDF here',
  hint = 'or click to browse',
  compact = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 bg-white ${
        compact ? 'p-6' : 'p-10'
      } ${over ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
        className="hidden"
      />
      <div className={`mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center ${compact ? 'w-12 h-12 mb-3' : 'w-20 h-20 mb-4'}`}>
        <svg className={compact ? 'w-6 h-6 text-emerald-500' : 'w-10 h-10 text-emerald-500'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <h3 className={`font-semibold text-slate-800 mb-1 ${compact ? 'text-sm' : 'text-lg'}`}>{title}</h3>
      <p className="text-slate-500 text-sm">{hint}</p>
    </div>
  );
}

/* -------------------------------------------------------------- file header */

export function FileBar({
  file,
  detail,
  onChange,
  label = 'Change',
}: {
  file: File;
  detail?: string;
  onChange: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
        <p className="text-xs text-slate-500">
          {formatFileSize(file.size)}
          {detail ? ` · ${detail}` : ''}
        </p>
      </div>
      <button onClick={onChange} className="shrink-0 text-sm text-slate-500 hover:text-slate-700">
        {label}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- feedback UI */

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">
      {message}
    </div>
  );
}

export function WarningBox({ items, title }: { items: string[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      {title && <p className="text-sm font-bold text-amber-800 mb-1.5">{title}</p>}
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-amber-800 leading-relaxed flex gap-2">
            <span className="text-amber-500 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-500">
        <span>{label ?? 'Working'}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-200" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-emerald-200"
    >
      {busy ? 'Processing…' : children}
    </button>
  );
}

export function ResultPanel({
  title,
  name,
  size,
  onDownload,
  onReset,
  resetLabel = 'Start over',
  children,
}: {
  title: string;
  name: string;
  size: number;
  onDownload: () => void;
  onReset: () => void;
  resetLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 truncate">{name}</p>
        </div>
      </div>

      {children}

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{name}</p>
          <p className="text-xs text-slate-500">{formatFileSize(size)}</p>
        </div>
        <button
          onClick={onDownload}
          className="shrink-0 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>

      <button onClick={onReset} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">
        {resetLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ form controls */

export function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-6">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700 mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400 mt-1 block">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl font-semibold transition-all border ${
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
          } ${
            value === option.value
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
      />
      <span>
        <span className="text-sm font-medium text-slate-700 block">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm text-slate-500 tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}

/* --------------------------------------------------------------- page stage */

export interface PageSize {
  width: number;
  height: number;
}

/**
 * Renders one PDF page as an image and reports its on-screen size, so callers
 * can overlay interactive layers using normalised (0..1) coordinates.
 */
export function PageStage({
  file,
  pageIndex,
  scale = 1.6,
  overlay,
  onSize,
  className = '',
  children,
}: {
  file: File;
  pageIndex: number;
  scale?: number;
  overlay?: React.ReactNode;
  onSize?: (size: PageSize) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  // Keyed by the exact render request, so a stale result can never be shown
  // and the effect never has to clear state synchronously.
  const key = `${file.name}:${file.size}:${file.lastModified}:${pageIndex}:${scale}`;
  const [render, setRender] = useState<{ key: string; src: string | null; error: boolean }>({
    key: '',
    src: null,
    error: false,
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await renderPDFPage(file, pageIndex + 1, scale);
        if (!cancelled) setRender({ key, src: url, error: false });
      } catch {
        if (!cancelled) setRender({ key, src: null, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [file, pageIndex, scale, key]);

  const src = render.key === key ? render.src : null;
  const error = render.key === key ? render.error : false;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !onSize) return;
    const report = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) onSize({ width: rect.width, height: rect.height });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onSize, src]);

  return (
    <div ref={boxRef} className={`relative inline-block max-w-full ${className}`}>
      {error ? (
        <div className="py-16 px-10 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          This page could not be rendered.
        </div>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Page ${pageIndex + 1}`} draggable={false} className="block w-full h-auto rounded-lg border border-slate-200 shadow-sm bg-white select-none" />
      ) : (
        <div className="py-24 px-16 flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          <span className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
          Rendering page…
        </div>
      )}
      {src && overlay}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ page selector */

export function PageNavigator({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-slate-700"
      >
        Previous
      </button>
      <span className="text-sm text-slate-600 tabular-nums">
        Page {page + 1} of {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page >= total - 1}
        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-slate-700"
      >
        Next
      </button>
    </div>
  );
}

/** Download a blob with a filename, without leaking the object URL. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
