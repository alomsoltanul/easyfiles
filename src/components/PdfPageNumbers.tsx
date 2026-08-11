'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_NUMBER_OPTIONS,
  addPageNumbers,
  renderLabel,
  type NumberFontKey,
  type NumberPosition,
  type NumeralStyle,
  type PageNumberOptions,
} from '@/lib/pdf-page-numbers';
import { parsePageRange, renderedSize } from '@/lib/pdf-common';
import { getPageGeometry } from '@/lib/pdf-render';
import {
  Dropzone, FileBar, ErrorBox, PrimaryButton, ResultPanel, Section, Field,
  SegmentedControl, Toggle, Slider, PageStage, PageNavigator, inputClass, downloadBlob,
} from './pdf/shared';

const POSITIONS: NumberPosition[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const FORMAT_PRESETS = [
  { value: '{n}', label: '1' },
  { value: 'Page {n}', label: 'Page 1' },
  { value: '{n} of {N}', label: '1 of 10' },
  { value: 'Page {n} of {N}', label: 'Page 1 of 10' },
  { value: '- {n} -', label: '- 1 -' },
];

const FONTS: NumberFontKey[] = ['Helvetica', 'Helvetica-Bold', 'Times', 'Times-Bold', 'Courier', 'Courier-Bold'];

const NUMERALS: { value: NumeralStyle; label: string }[] = [
  { value: 'arabic', label: '1, 2, 3' },
  { value: 'roman-lower', label: 'i, ii, iii' },
  { value: 'roman-upper', label: 'I, II, III' },
  { value: 'alpha-lower', label: 'a, b, c' },
  { value: 'alpha-upper', label: 'A, B, C' },
];

type Geometry = { width: number; height: number; rotation: number };

export default function PdfPageNumbers() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);
  const [page, setPage] = useState(0);
  const [options, setOptions] = useState<PageNumberOptions>(DEFAULT_PAGE_NUMBER_OPTIONS);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const set = useCallback(<K extends keyof PageNumberOptions>(key: K, value: PageNumberOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setPage(0);
    setGeometry([]);
    try {
      setGeometry(await getPageGeometry(next));
    } catch {
      setError('This PDF could not be read. It may be corrupt or password-protected.');
    }
  }, []);

  const targets = useMemo(
    () => (geometry.length ? parsePageRange(options.pageRange, geometry.length) : []),
    [options.pageRange, geometry.length]
  );

  // Where the label lands on the page currently being previewed.
  const preview = useMemo(() => {
    const geo = geometry[page];
    if (!geo) return null;
    const position = targets.indexOf(page + 1);
    if (position < 0) return null;

    const view = renderedSize(geo.width, geo.height, geo.rotation);
    const label = renderLabel(
      options.format,
      options.startAt + position,
      targets.length + options.startAt - 1,
      options.numeralStyle
    );

    let side: 'left' | 'right' | 'center' =
      options.position.endsWith('left') ? 'left' : options.position.endsWith('right') ? 'right' : 'center';
    if (options.mirrorMargins && (page + 1) % 2 === 0 && side !== 'center') {
      side = side === 'left' ? 'right' : 'left';
    }

    return {
      label,
      side,
      top: options.position.startsWith('top'),
      xPercent: (options.marginX / view.width) * 100,
      yPercent: (options.marginY / view.height) * 100,
      // Points → on-screen pixels for the rendered page.
      sizePx: stage.height ? (options.size * stage.height) / view.height : options.size,
    };
  }, [geometry, page, targets, options, stage.height]);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await addPageNumbers(file, options));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add page numbers');
    } finally {
      setBusy(false);
    }
  }, [file, options]);

  const reset = useCallback(() => {
    setFile(null);
    setGeometry([]);
    setResult(null);
    setError(null);
    setPage(0);
  }, []);

  if (!file) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Upload PDF</h2>
        <Dropzone onFiles={handleFile} />
      </div>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title="Page numbers added"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Number another PDF"
      />
    );
  }

  return (
    <div className="space-y-8">
      <FileBar file={file} detail={geometry.length ? `${geometry.length} pages` : undefined} onChange={reset} />

      <Section title="Preview" hint={`${targets.length} of ${geometry.length || '…'} pages will be numbered`}>
        <div className="flex flex-col items-center gap-4">
          <PageStage
            file={file}
            pageIndex={page}
            scale={1.4}
            className="w-full max-w-md"
            onSize={setStage}
            overlay={
              preview ? (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: preview.side === 'left' ? `${preview.xPercent}%` : undefined,
                    right: preview.side === 'right' ? `${preview.xPercent}%` : undefined,
                    ...(preview.side === 'center'
                      ? { left: '50%', transform: 'translateX(-50%)' }
                      : {}),
                    top: preview.top ? `${preview.yPercent}%` : undefined,
                    bottom: preview.top ? undefined : `${preview.yPercent}%`,
                  }}
                >
                  <span
                    className="inline-block px-1 rounded bg-emerald-100/70 ring-1 ring-emerald-400 leading-none"
                    style={{ color: options.color, fontSize: `${Math.max(7, preview.sizePx)}px` }}
                  >
                    {preview.label}
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-semibold bg-slate-900/70 text-white px-2 py-1 rounded">
                    Not numbered
                  </span>
                </div>
              )
            }
          />
          <PageNavigator page={page} total={geometry.length || 1} onChange={setPage} />
        </div>
      </Section>

      <Section title="Format">
        <div className="space-y-4">
          <SegmentedControl
            value={FORMAT_PRESETS.some((p) => p.value === options.format) ? options.format : 'custom'}
            onChange={(v) => v !== 'custom' && set('format', v)}
            options={[...FORMAT_PRESETS, { value: 'custom', label: 'Custom' }]}
            size="sm"
          />
          <Field label="Template" hint="{n} is the page number, {N} is the total">
            <input value={options.format} onChange={(e) => set('format', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Numerals">
            <select
              value={options.numeralStyle}
              onChange={(e) => set('numeralStyle', e.target.value as NumeralStyle)}
              className={inputClass}
            >
              {NUMERALS.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Placement">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 max-w-xs">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => set('position', pos)}
                className={`h-12 rounded-lg border text-[10px] font-semibold uppercase tracking-wide transition-all ${
                  options.position === pos
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {pos.replace('-', ' ')}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider label="Side margin" value={options.marginX} min={8} max={144} suffix="pt" onChange={(v) => set('marginX', v)} />
            <Slider label="Top / bottom margin" value={options.marginY} min={8} max={144} suffix="pt" onChange={(v) => set('marginY', v)} />
          </div>
          <Toggle
            checked={options.mirrorMargins}
            onChange={(v) => set('mirrorMargins', v)}
            label="Mirror margins on even pages"
            hint="For double-sided printing — numbers alternate outer edges"
          />
        </div>
      </Section>

      <Section title="Typography">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Font">
            <select value={options.font} onChange={(e) => set('font', e.target.value as NumberFontKey)} className={inputClass}>
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Colour">
            <div className="flex gap-2 items-center">
              <input type="color" value={options.color} onChange={(e) => set('color', e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
              <input value={options.color} onChange={(e) => set('color', e.target.value)} className={inputClass} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Slider label="Size" value={options.size} min={6} max={36} suffix="pt" onChange={(v) => set('size', v)} />
          </div>
        </div>
      </Section>

      <Section title="Pages">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Page range" hint="Blank for every page — e.g. 2-, 1-3, 8">
            <input
              value={options.pageRange}
              onChange={(e) => set('pageRange', e.target.value)}
              placeholder="All pages"
              className={inputClass}
            />
          </Field>
          <Field label="First number" hint="The value printed on the first numbered page">
            <input
              type="number"
              min={0}
              value={options.startAt}
              onChange={(e) => set('startAt', Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <ErrorBox message={error} />

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy} disabled={targets.length === 0}>
          Add page numbers
        </PrimaryButton>
      </div>
    </div>
  );
}
