'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_COMPARE_OPTIONS,
  buildComparisonReport,
  comparePDFs,
  type CompareOptions,
  type CompareResult,
} from '@/lib/pdf-compare';
import {
  Dropzone, ErrorBox, WarningBox, PrimaryButton, Section, Toggle, Slider,
  ProgressBar, PageNavigator, downloadBlob,
} from './pdf/shared';
import { formatFileSize } from '@/lib/converters';

type View = 'side-by-side' | 'overlay' | 'text';

const STATUS_STYLE: Record<string, string> = {
  unchanged: 'bg-slate-100 text-slate-500',
  changed: 'bg-amber-100 text-amber-700',
  added: 'bg-emerald-100 text-emerald-700',
  removed: 'bg-red-100 text-red-700',
};

export default function PdfCompare() {
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_COMPARE_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>('side-by-side');
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [exporting, setExporting] = useState(false);

  const run = useCallback(async () => {
    if (!left || !right) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    setResult(null);
    try {
      const output = await comparePDFs(left, right, options, setProgress);
      setResult(output);
      const firstChange = output.pages.findIndex((p) => p.status !== 'unchanged');
      setPage(firstChange >= 0 ? firstChange : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compare these files');
    } finally {
      setBusy(false);
    }
  }, [left, right, options]);

  const reset = useCallback(() => {
    setLeft(null);
    setRight(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setPage(0);
  }, []);

  const exportReport = useCallback(async () => {
    if (!result) return;
    setExporting(true);
    try {
      const report = await buildComparisonReport(result);
      downloadBlob(report.blob, report.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the report');
    } finally {
      setExporting(false);
    }
  }, [result]);

  const visiblePages = useMemo(() => {
    if (!result) return [];
    return onlyChanges ? result.pages.filter((p) => p.status !== 'unchanged') : result.pages;
  }, [result, onlyChanges]);

  const current = result?.pages[page] ?? null;

  if (!result) {
    return (
      <div className="space-y-8">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-700">Original</h3>
            {left ? (
              <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{left.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(left.size)}</p>
                </div>
                <button onClick={() => setLeft(null)} className="text-sm text-slate-500 hover:text-slate-700 shrink-0">Change</button>
              </div>
            ) : (
              <Dropzone onFiles={(f) => setLeft(f[0] ?? null)} compact title="Drop the original PDF" hint="or click to browse" />
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-700">Revision</h3>
            {right ? (
              <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{right.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(right.size)}</p>
                </div>
                <button onClick={() => setRight(null)} className="text-sm text-slate-500 hover:text-slate-700 shrink-0">Change</button>
              </div>
            ) : (
              <Dropzone onFiles={(f) => setRight(f[0] ?? null)} compact title="Drop the newer PDF" hint="or click to browse" />
            )}
          </div>
        </div>

        <Section title="Comparison settings">
          <div className="space-y-4">
            <Toggle
              checked={options.textOnly}
              onChange={(v) => setOptions((p) => ({ ...p, textOnly: v }))}
              label="Text only (faster)"
              hint="Skips the pixel pass — useful for long documents"
            />
            <Toggle
              checked={options.ignoreWhitespace}
              onChange={(v) => setOptions((p) => ({ ...p, ignoreWhitespace: v }))}
              label="Ignore whitespace differences"
            />
            {!options.textOnly && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Slider label="Render quality" value={options.scale} min={0.6} max={2.4} step={0.2} suffix="×" onChange={(v) => setOptions((p) => ({ ...p, scale: v }))} />
                <Slider label="Pixel tolerance" value={options.pixelTolerance} min={0} max={80} onChange={(v) => setOptions((p) => ({ ...p, pixelTolerance: v }))} />
              </div>
            )}
            <Slider label="Maximum pages to compare" value={options.maxPages} min={5} max={200} step={5} onChange={(v) => setOptions((p) => ({ ...p, maxPages: v }))} />
          </div>
        </Section>

        <ErrorBox message={error} />
        {busy && <ProgressBar value={progress} label="Comparing pages" />}

        <div className="border-t border-slate-100 pt-6">
          <PrimaryButton onClick={run} busy={busy} disabled={!left || !right}>Compare documents</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Comparison complete</h2>
          <p className="text-sm text-slate-500 truncate max-w-xl">
            {result.leftName} ({result.leftPages}p) → {result.rightName} ({result.rightPages}p)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportReport}
            disabled={exporting}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {exporting ? 'Building…' : 'Download report'}
          </button>
          <button onClick={reset} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
            New comparison
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Changed', value: result.changed, tone: 'text-amber-600' },
          { label: 'Added', value: result.added, tone: 'text-emerald-600' },
          { label: 'Removed', value: result.removed, tone: 'text-red-600' },
          { label: 'Identical', value: result.pages.filter((p) => p.status === 'unchanged').length, tone: 'text-slate-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{stat.label} pages</p>
          </div>
        ))}
      </div>

      {result.truncated && (
        <WarningBox items={[`Only the first ${options.maxPages} pages were compared. Raise the page limit to cover the whole document.`]} />
      )}

      <Section title="Pages">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Toggle checked={onlyChanges} onChange={setOnlyChanges} label="Show changed pages only" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visiblePages.map((p) => (
              <button
                key={p.index}
                onClick={() => setPage(p.index)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-all ${
                  p.index === page ? 'ring-2 ring-slate-900 ' : ''
                }${STATUS_STYLE[p.status]}`}
                title={`${p.status} · ${(p.textSimilarity * 100).toFixed(0)}% text match`}
              >
                {p.index + 1}
              </button>
            ))}
            {visiblePages.length === 0 && <p className="text-sm text-slate-500">The two documents are identical.</p>}
          </div>
        </div>
      </Section>

      {current && (
        <Section title={`Page ${current.index + 1}`} hint={`${current.status} · ${(current.textSimilarity * 100).toFixed(1)}% text match · ${(current.pixelDelta * 100).toFixed(2)}% pixels changed`}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['side-by-side', 'overlay', 'text'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  disabled={v !== 'text' && options.textOnly}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                    view === v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {v === 'side-by-side' ? 'Side by side' : v === 'overlay' ? 'Difference overlay' : 'Text diff'}
                </button>
              ))}
            </div>

            {view === 'text' ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-96 overflow-y-auto text-sm leading-relaxed">
                {current.ops.length === 0 ? (
                  <p className="text-slate-500">No text layer on this page.</p>
                ) : (
                  current.ops.map((op, i) => (
                    <span
                      key={i}
                      className={
                        op.type === 'insert'
                          ? 'bg-emerald-100 text-emerald-900 rounded px-0.5'
                          : op.type === 'delete'
                          ? 'bg-red-100 text-red-900 line-through rounded px-0.5'
                          : 'text-slate-600'
                      }
                    >
                      {op.text}{' '}
                    </span>
                  ))
                )}
              </div>
            ) : view === 'overlay' ? (
              <div className="flex justify-center bg-slate-50 rounded-xl border border-slate-200 p-4">
                {current.diffImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.diffImage} alt="Difference overlay" className="max-h-[32rem] w-auto rounded-lg border border-slate-200 shadow-sm bg-white" />
                ) : (
                  <p className="py-12 text-sm text-slate-500">This page only exists in one document.</p>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: result.leftName, src: current.leftImage },
                  { label: result.rightName, src: current.rightImage },
                ].map((side, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 truncate">{side.label}</p>
                    <div className="flex justify-center bg-slate-50 rounded-xl border border-slate-200 p-3 min-h-[8rem]">
                      {side.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={side.src} alt={side.label} className="max-h-[28rem] w-auto rounded-lg border border-slate-200 shadow-sm bg-white" />
                      ) : (
                        <p className="py-12 text-sm text-slate-400">Page not present</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {view === 'overlay' && (
              <p className="text-xs text-slate-500 text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-600 align-middle mr-1" /> only in the original
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600 align-middle ml-4 mr-1" /> only in the revision
              </p>
            )}

            <PageNavigator page={page} total={result.pages.length} onChange={setPage} />
          </div>
        </Section>
      )}

      <ErrorBox message={error} />
    </div>
  );
}
