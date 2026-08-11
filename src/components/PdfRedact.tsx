'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_REDACT_OPTIONS,
  findTextMatches,
  redactPDF,
  type Redaction,
  type RedactOptions,
} from '@/lib/pdf-redact';
import { getPageGeometry } from '@/lib/pdf-render';
import {
  Dropzone, FileBar, ErrorBox, WarningBox, PrimaryButton, ResultPanel, Section, Field,
  Toggle, Slider, ProgressBar, PageStage, PageNavigator, inputClass, downloadBlob,
} from './pdf/shared';

let seq = 0;
const nextId = () => `r-${++seq}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function PdfRedact() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [options, setOptions] = useState<RedactOptions>(DEFAULT_REDACT_OPTIONS);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const draft = useRef<{ id: string; startX: number; startY: number } | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setRedactions([]);
    setPage(0);
    setPageCount(0);
    setSearchInfo(null);
    try {
      const geometry = await getPageGeometry(next);
      setPageCount(geometry.length);
    } catch {
      setError('This PDF could not be read. It may be corrupt or password-protected.');
    }
  }, []);

  const pointOf = useCallback((event: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    const point = pointOf(event);
    if (!point) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const id = nextId();
    draft.current = { id, startX: point.x, startY: point.y };
    setRedactions((prev) => [...prev, { id, page, rect: { x: point.x, y: point.y, width: 0, height: 0 } }]);
  }, [pointOf, page]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const current = draft.current;
    if (!current) return;
    const point = pointOf(event);
    if (!point) return;
    setRedactions((prev) =>
      prev.map((r) =>
        r.id === current.id
          ? {
              ...r,
              rect: {
                x: Math.min(current.startX, point.x),
                y: Math.min(current.startY, point.y),
                width: Math.abs(point.x - current.startX),
                height: Math.abs(point.y - current.startY),
              },
            }
          : r
      )
    );
  }, [pointOf]);

  const onPointerUp = useCallback(() => {
    const current = draft.current;
    draft.current = null;
    if (!current) return;
    setRedactions((prev) => prev.filter((r) => r.id !== current.id || (r.rect.width > 0.004 && r.rect.height > 0.004)));
  }, []);

  const search = useCallback(async () => {
    if (!file || !query.trim()) return;
    setSearching(true);
    setError(null);
    setSearchInfo(null);
    try {
      const matches = await findTextMatches(file, query, { caseSensitive, wholeWord });
      if (matches.length === 0) {
        setSearchInfo(`No matches for “${query}”. Scanned PDFs have no text layer — run OCR first, or draw the boxes by hand.`);
      } else {
        setRedactions((prev) => [
          ...prev,
          ...matches.map((m) => ({ id: nextId(), page: m.page, rect: m.rect, label: m.text })),
        ]);
        setSearchInfo(`Marked ${matches.length} match${matches.length === 1 ? '' : 'es'} across the document.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [file, query, caseSensitive, wholeWord]);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      setResult(await redactPDF(file, redactions, options, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redact this PDF');
    } finally {
      setBusy(false);
    }
  }, [file, redactions, options]);

  const reset = useCallback(() => {
    setFile(null);
    setRedactions([]);
    setResult(null);
    setError(null);
    setPage(0);
    setPageCount(0);
    setSearchInfo(null);
  }, []);

  const onThisPage = useMemo(() => redactions.filter((r) => r.page === page), [redactions, page]);
  const affectedPages = useMemo(() => new Set(redactions.map((r) => r.page)).size, [redactions]);

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
        title="Redacted PDF ready"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Redact another PDF"
      >
        <WarningBox
          title="What changed"
          items={[
            `${redactions.length} area${redactions.length === 1 ? '' : 's'} on ${affectedPages} page${affectedPages === 1 ? '' : 's'} were flattened to an image with the content painted out — the original text is not recoverable from the output.`,
            'Pages without redactions were copied untouched, so they keep their text layer and full quality.',
          ]}
        />
      </ResultPanel>
    );
  }

  const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

  return (
    <div className="space-y-8">
      <FileBar
        file={file}
        detail={`${pageCount || '…'} pages · ${redactions.length} redaction${redactions.length === 1 ? '' : 's'}`}
        onChange={reset}
      />

      <WarningBox
        items={[
          'Redaction here is destructive by design: pages you mark are re-rendered and the marked pixels are painted out before the page is written, so nothing survives underneath.',
        ]}
      />

      <Section title="Mark what to remove" hint="Drag on the page to cover text, signatures or images">
        <div className="flex flex-col items-center gap-4">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full max-w-lg cursor-crosshair touch-none"
          >
            <PageStage
              file={file}
              pageIndex={page}
              scale={1.5}
              overlay={
                <div className="absolute inset-0">
                  {onThisPage.map((r) => (
                    <div
                      key={r.id}
                      className="absolute group"
                      style={{ left: pct(r.rect.x), top: pct(r.rect.y), width: pct(r.rect.width), height: pct(r.rect.height) }}
                    >
                      <div className="w-full h-full ring-2 ring-red-500" style={{ background: options.color }} />
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setRedactions((prev) => prev.filter((x) => x.id !== r.id))}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs shadow"
                        title="Remove this box"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
          <PageNavigator page={page} total={pageCount || 1} onChange={setPage} />
          {onThisPage.length > 0 && (
            <button
              onClick={() => setRedactions((prev) => prev.filter((r) => r.page !== page))}
              className="text-sm text-slate-500 hover:text-red-600"
            >
              Clear {onThisPage.length} box{onThisPage.length === 1 ? '' : 'es'} on this page
            </button>
          )}
        </div>
      </Section>

      <Section title="Find and redact text" hint="Adds a box over every occurrence in the document">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              placeholder="Name, account number, email…"
              className={inputClass}
            />
            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold"
            >
              {searching ? 'Searching…' : 'Find & mark'}
            </button>
          </div>
          <div className="flex flex-wrap gap-6">
            <Toggle checked={caseSensitive} onChange={setCaseSensitive} label="Match case" />
            <Toggle checked={wholeWord} onChange={setWholeWord} label="Whole words only" />
          </div>
          {searchInfo && <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">{searchInfo}</p>}
        </div>
      </Section>

      <Section title="Output">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Slider label="Quality of redacted pages" value={options.dpi} min={100} max={400} step={25} suffix=" DPI" onChange={(v) => setOptions((p) => ({ ...p, dpi: v }))} />
              <p className="text-xs text-slate-400 mt-1">Higher keeps small print readable; larger file.</p>
            </div>
            <Field label="Box colour">
              <div className="flex gap-2 items-center">
                <input type="color" value={options.color} onChange={(e) => setOptions((p) => ({ ...p, color: e.target.value }))} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input value={options.color} onChange={(e) => setOptions((p) => ({ ...p, color: e.target.value }))} className={inputClass} />
              </div>
            </Field>
          </div>
          <Toggle
            checked={options.stripMetadata}
            onChange={(v) => setOptions((p) => ({ ...p, stripMetadata: v }))}
            label="Strip document metadata"
            hint="Clears title, author, subject and keywords, which often leak the same information"
          />
        </div>
      </Section>

      <ErrorBox message={error} />
      {busy && <ProgressBar value={progress} label="Burning in redactions" />}

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy} disabled={redactions.length === 0}>
          Apply {redactions.length || ''} redaction{redactions.length === 1 ? '' : 's'}
        </PrimaryButton>
      </div>
    </div>
  );
}
