'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BLANK_SIZES, organizePDF, type OrganizeItem } from '@/lib/pdf-organize';
import { renderPDFThumbnails } from '@/lib/pdf-render';
import {
  Dropzone, ErrorBox, PrimaryButton, ResultPanel, Section, ProgressBar, downloadBlob,
} from './pdf/shared';
import { formatFileSize } from '@/lib/converters';

interface Source {
  file: File;
  thumbs: string[];
}

let counter = 0;
const nextId = () => `item-${++counter}`;

export default function PdfOrganize() {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<OrganizeItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const dragIndex = useRef<number | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      setError('Only PDF files can be added.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const base = sources.length;
      const loaded: Source[] = [];
      const added: OrganizeItem[] = [];

      for (let i = 0; i < pdfs.length; i++) {
        const thumbs = await renderPDFThumbnails(pdfs[i], 0.4);
        loaded.push({ file: pdfs[i], thumbs });
        thumbs.forEach((_, pageIndex) => {
          added.push({ kind: 'page', id: nextId(), sourceIndex: base + i, pageIndex, rotation: 0 });
        });
      }

      setSources((prev) => [...prev, ...loaded]);
      setItems((prev) => [...prev, ...added]);
    } catch {
      setError('One of those PDFs could not be read. It may be corrupt or password-protected.');
    } finally {
      setLoading(false);
    }
  }, [sources.length]);

  const update = useCallback((id: string, mutate: (item: OrganizeItem) => OrganizeItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? mutate(item) : item)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const duplicate = useCallback((id: string) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const copy = { ...prev[index], id: nextId() };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const move = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const rotate = useCallback((id: string, delta: number) => {
    update(id, (item) => (item.kind === 'page' ? { ...item, rotation: (((item.rotation + delta) % 360) + 360) % 360 } : item));
  }, [update]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulk = useCallback((action: 'delete' | 'rotate-left' | 'rotate-right') => {
    if (selected.size === 0) return;
    if (action === 'delete') {
      setItems((prev) => prev.filter((item) => !selected.has(item.id)));
      setSelected(new Set());
      return;
    }
    const delta = action === 'rotate-left' ? -90 : 90;
    setItems((prev) =>
      prev.map((item) =>
        selected.has(item.id) && item.kind === 'page'
          ? { ...item, rotation: (((item.rotation + delta) % 360) + 360) % 360 }
          : item
      )
    );
  }, [selected]);

  const insertBlank = useCallback((size: keyof typeof BLANK_SIZES) => {
    const [width, height] = BLANK_SIZES[size];
    setItems((prev) => [...prev, { kind: 'blank', id: nextId(), width, height }]);
  }, []);

  const run = useCallback(async () => {
    if (items.length === 0) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const output = await organizePDF(sources.map((s) => s.file), items, setProgress);
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the document');
    } finally {
      setBusy(false);
    }
  }, [items, sources]);

  const reset = useCallback(() => {
    setSources([]);
    setItems([]);
    setSelected(new Set());
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  const stats = useMemo(() => {
    const blanks = items.filter((i) => i.kind === 'blank').length;
    const rotated = items.filter((i) => i.kind === 'page' && i.rotation !== 0).length;
    const totalSource = sources.reduce((n, s) => n + s.thumbs.length, 0);
    return { blanks, rotated, totalSource };
  }, [items, sources]);

  if (sources.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Upload PDFs</h2>
        <Dropzone
          onFiles={addFiles}
          multiple
          title="Drop one or more PDFs here"
          hint="Every page lands in one page manager — sort, rotate, delete or insert"
        />
        {loading && <p className="text-sm text-slate-500 text-center">Loading pages…</p>}
        <ErrorBox message={error} />
      </div>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title="Document organized"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Organize another document"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {items.length} page{items.length === 1 ? '' : 's'} in the new document
          </p>
          <p className="text-xs text-slate-500">
            {sources.length} source file{sources.length === 1 ? '' : 's'} · {stats.totalSource} original pages
            {stats.blanks > 0 && ` · ${stats.blanks} blank`}
            {stats.rotated > 0 && ` · ${stats.rotated} rotated`}
          </p>
        </div>
        <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">Start over</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={addRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
        <button onClick={() => addRef.current?.click()} className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold">
          Add PDF
        </button>
        {(['A4', 'Letter', 'Legal', 'A3'] as const).map((size) => (
          <button key={size} onClick={() => insertBlank(size)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
            + Blank {size}
          </button>
        ))}
        <button
          onClick={() => setSelected(new Set(items.map((i) => i.id)))}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
        >
          Select all
        </button>
        {selected.size > 0 && (
          <>
            <span className="px-3 py-2 text-sm text-slate-500">{selected.size} selected</span>
            <button onClick={() => bulk('rotate-left')} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">Rotate ⟲</button>
            <button onClick={() => bulk('rotate-right')} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">Rotate ⟳</button>
            <button onClick={() => bulk('delete')} className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold">Delete</button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-2 rounded-xl text-slate-500 text-sm font-semibold">Clear</button>
          </>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading pages…</p>}

      <Section title="Page manager" hint="Drag a page onto another position to reorder">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Every page was removed. Add a PDF or a blank page.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item, index) => {
              const isSelected = selected.has(item.id);
              const source = item.kind === 'page' ? sources[item.sourceIndex] : null;
              const thumb = item.kind === 'page' ? source?.thumbs[item.pageIndex] : null;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => { dragIndex.current = index; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) move(dragIndex.current, index);
                    dragIndex.current = null;
                  }}
                  onDragEnd={() => { dragIndex.current = null; }}
                  className={`group relative rounded-xl border-2 bg-white p-2 cursor-grab active:cursor-grabbing transition-all ${
                    isSelected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                      />
                      <span className="text-[11px] font-bold text-slate-400 tabular-nums">{index + 1}</span>
                    </label>
                    <button
                      onClick={() => remove(item.id)}
                      title="Remove page"
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="aspect-[3/4] bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100">
                    {item.kind === 'blank' ? (
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Blank</span>
                    ) : thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={`Page ${item.pageIndex + 1}`}
                        className="max-w-full max-h-full object-contain transition-transform"
                        style={{ transform: `rotate(${item.rotation}deg)` }}
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">…</span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 truncate max-w-[60%]">
                      {item.kind === 'blank'
                        ? `${Math.round(item.width)}×${Math.round(item.height)}pt`
                        : `${sources.length > 1 ? `#${item.sourceIndex + 1} · ` : ''}p${item.pageIndex + 1}`}
                    </span>
                    <div className="flex gap-0.5">
                      {item.kind === 'page' && (
                        <>
                          <button onClick={() => rotate(item.id, -90)} title="Rotate left" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M5 10a8 8 0 0114-3" />
                            </svg>
                          </button>
                          <button onClick={() => rotate(item.id, 90)} title="Rotate right" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 4v6h-6M19 10a8 8 0 00-14-3" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button onClick={() => duplicate(item.id)} title="Duplicate" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8a2 2 0 012 2v8M6 5h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="absolute inset-y-0 left-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => move(index, index - 1)} disabled={index === 0} className="bg-white/90 border border-slate-200 rounded-r-lg px-1 py-2 disabled:opacity-0 text-slate-500 hover:text-slate-800">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => move(index, index + 1)} disabled={index === items.length - 1} className="bg-white/90 border border-slate-200 rounded-l-lg px-1 py-2 disabled:opacity-0 text-slate-500 hover:text-slate-800">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="text-xs text-slate-500">
        Sources: {sources.map((s) => `${s.file.name} (${formatFileSize(s.file.size)})`).join(' · ')}
      </div>

      <ErrorBox message={error} />
      {busy && <ProgressBar value={progress} label="Building document" />}

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy} disabled={items.length === 0}>
          Save organized PDF
        </PrimaryButton>
      </div>
    </div>
  );
}
