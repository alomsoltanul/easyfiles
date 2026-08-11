'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CROP_OPTIONS,
  cropPDF,
  detectContentRect,
  marginsToRect,
  type CropOptions,
} from '@/lib/pdf-crop';
import { parsePageRange, renderedSize, type NormRect } from '@/lib/pdf-common';
import { getPageGeometry, renderPageToCanvas } from '@/lib/pdf-render';
import {
  Dropzone, FileBar, ErrorBox, PrimaryButton, ResultPanel, Section, Field,
  SegmentedControl, Toggle, PageStage, PageNavigator, inputClass, downloadBlob,
} from './pdf/shared';

type Geometry = { width: number; height: number; rotation: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function PdfCrop() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);
  const [page, setPage] = useState(0);
  const [options, setOptions] = useState<CropOptions>(DEFAULT_CROP_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const set = useCallback(<K extends keyof CropOptions>(key: K, value: CropOptions[K]) => {
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
    setOptions(DEFAULT_CROP_OPTIONS);
    try {
      setGeometry(await getPageGeometry(next));
    } catch {
      setError('This PDF could not be read. It may be corrupt or password-protected.');
    }
  }, []);

  const view = useMemo(() => {
    const geo = geometry[page];
    if (!geo) return null;
    return renderedSize(geo.width, geo.height, geo.rotation);
  }, [geometry, page]);

  const cropRect: NormRect = useMemo(() => {
    if (options.mode === 'rect') return options.rect;
    if (!view) return { x: 0, y: 0, width: 1, height: 1 };
    return marginsToRect(options.margins, view.width, view.height);
  }, [options, view]);

  const targets = useMemo(
    () => (geometry.length ? parsePageRange(options.pageRange, geometry.length) : []),
    [options.pageRange, geometry.length]
  );

  const pointerRect = useCallback((event: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (options.mode !== 'rect') return;
    const point = pointerRect(event);
    if (!point) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragStart.current = point;
    setOptions((prev) => ({ ...prev, rect: { x: point.x, y: point.y, width: 0, height: 0 } }));
  }, [options.mode, pointerRect]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (options.mode !== 'rect' || !dragStart.current) return;
    const point = pointerRect(event);
    if (!point) return;
    const start = dragStart.current;
    setOptions((prev) => ({
      ...prev,
      rect: {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      },
    }));
  }, [options.mode, pointerRect]);

  const onPointerUp = useCallback(() => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setOptions((prev) => {
      if (prev.rect.width < 0.02 || prev.rect.height < 0.02) {
        return { ...prev, rect: DEFAULT_CROP_OPTIONS.rect };
      }
      return prev;
    });
  }, []);

  const autoDetect = useCallback(async () => {
    if (!file) return;
    setDetecting(true);
    setError(null);
    try {
      const canvas = await renderPageToCanvas(file, page + 1, 1.2);
      const detected = detectContentRect(canvas);
      if (!detected) {
        setError('That page looks blank — nothing to crop to.');
      } else {
        setOptions((prev) => ({ ...prev, mode: 'rect', rect: detected }));
      }
    } catch {
      setError('Could not analyse this page.');
    } finally {
      setDetecting(false);
    }
  }, [file, page]);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await cropPDF(file, options));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop this PDF');
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

  const setMargin = (edge: keyof CropOptions['margins'], value: number) =>
    setOptions((prev) => ({ ...prev, margins: { ...prev.margins, [edge]: Math.max(0, value) } }));

  const setAllMargins = (value: number) =>
    setOptions((prev) => ({ ...prev, margins: { top: value, right: value, bottom: value, left: value } }));

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
        title="PDF cropped"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Crop another PDF"
      />
    );
  }

  const percent = (n: number) => `${(n * 100).toFixed(4)}%`;

  return (
    <div className="space-y-8">
      <FileBar file={file} detail={geometry.length ? `${geometry.length} pages` : undefined} onChange={reset} />

      <Section
        title="Crop area"
        hint={options.mode === 'rect' ? 'Drag on the page to draw the area you want to keep' : 'Set how much to trim from each edge'}
      >
        <div className="space-y-4">
          <SegmentedControl
            value={options.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'margins', label: 'Trim margins' },
              { value: 'rect', label: 'Select area' },
            ]}
          />

          <div className="flex flex-col items-center gap-4">
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`relative w-full max-w-lg ${options.mode === 'rect' ? 'cursor-crosshair touch-none' : ''}`}
            >
              <PageStage
                file={file}
                pageIndex={page}
                scale={1.5}
                overlay={
                  <>
                    {/* Everything outside the crop is dimmed. */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute bg-slate-900/45" style={{ left: 0, right: 0, top: 0, height: percent(cropRect.y) }} />
                      <div className="absolute bg-slate-900/45" style={{ left: 0, right: 0, top: percent(cropRect.y + cropRect.height), bottom: 0 }} />
                      <div className="absolute bg-slate-900/45" style={{ top: percent(cropRect.y), height: percent(cropRect.height), left: 0, width: percent(cropRect.x) }} />
                      <div className="absolute bg-slate-900/45" style={{ top: percent(cropRect.y), height: percent(cropRect.height), left: percent(cropRect.x + cropRect.width), right: 0 }} />
                      <div
                        className="absolute border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
                        style={{
                          left: percent(cropRect.x),
                          top: percent(cropRect.y),
                          width: percent(cropRect.width),
                          height: percent(cropRect.height),
                        }}
                      />
                    </div>
                  </>
                }
              />
            </div>
            <PageNavigator page={page} total={geometry.length || 1} onChange={setPage} />
            {view && (
              <p className="text-xs text-slate-500 tabular-nums">
                Result: {(cropRect.width * view.width).toFixed(0)} × {(cropRect.height * view.height).toFixed(0)} pt
                {' · '}
                {((cropRect.width * cropRect.height) * 100).toFixed(1)}% of the page kept
              </p>
            )}
          </div>

          {options.mode === 'margins' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
                <Field key={edge} label={edge[0].toUpperCase() + edge.slice(1)}>
                  <input
                    type="number"
                    min={0}
                    value={options.margins[edge]}
                    onChange={(e) => setMargin(edge, Number(e.target.value) || 0)}
                    className={inputClass}
                  />
                </Field>
              ))}
              <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-2">
                {[0, 18, 36, 54, 72].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAllMargins(v)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600"
                  >
                    All {v}pt
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={autoDetect}
                disabled={detecting}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {detecting ? 'Analysing…' : 'Auto-detect content'}
              </button>
              <button
                onClick={() => set('rect', { x: 0, y: 0, width: 1, height: 1 })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
              >
                Reset selection
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Apply to">
        <div className="space-y-4">
          <Field label="Page range" hint="Blank for every page — e.g. 1-3, 8">
            <input
              value={options.pageRange}
              onChange={(e) => set('pageRange', e.target.value)}
              placeholder="All pages"
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-slate-500">{targets.length} of {geometry.length || '…'} pages will be cropped.</p>
          <Toggle
            checked={options.shrinkMediaBox}
            onChange={(v) => set('shrinkMediaBox', v)}
            label="Also shrink the page box"
            hint="Guarantees the crop shows everywhere; leave off to keep the trimmed area recoverable"
          />
        </div>
      </Section>

      <ErrorBox message={error} />

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy} disabled={targets.length === 0}>
          Crop PDF
        </PrimaryButton>
      </div>
    </div>
  );
}
