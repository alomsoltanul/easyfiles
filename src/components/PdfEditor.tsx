'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANNOTATION_FONTS,
  applyAnnotations,
  type Annotation,
  type AnnotationFontKey,
} from '@/lib/pdf-annotate';
import { renderedSize } from '@/lib/pdf-common';
import { getPageGeometry } from '@/lib/pdf-render';
import {
  Dropzone, FileBar, ErrorBox, PrimaryButton, ResultPanel, Section, Field,
  PageStage, PageNavigator, inputClass, downloadBlob,
} from './pdf/shared';

type Tool = 'select' | 'text' | 'draw' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'highlight' | 'image';

const TOOLS: { value: Tool; label: string; icon: React.ReactNode }[] = [
  { value: 'select', label: 'Select', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3l7.5 18 2.5-7.5L20.5 11 3 3z" /> },
  { value: 'text', label: 'Text', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6V4h16v2M12 4v16M9 20h6" /> },
  { value: 'draw', label: 'Draw', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21l3-1 11-11a2 2 0 10-3-3L3 17l-1 3 1 1z" /> },
  { value: 'rect', label: 'Rectangle', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16v12H4z" /> },
  { value: 'ellipse', label: 'Ellipse', icon: <ellipse cx="12" cy="12" rx="8" ry="6" strokeWidth={1.8} /> },
  { value: 'line', label: 'Line', icon: <path strokeLinecap="round" strokeWidth={1.8} d="M4 20L20 4" /> },
  { value: 'arrow', label: 'Arrow', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 20L20 4m0 0h-7m7 0v7" /> },
  { value: 'highlight', label: 'Highlight', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 14h16v5H4zM7 4h10v7H7z" /> },
  { value: 'image', label: 'Image', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4-4 3 3 5-5 4 4M4 6h16v12H4z" /> },
];

const FONT_KEYS = Object.keys(ANNOTATION_FONTS) as AnnotationFontKey[];

const SWATCHES = ['#0f172a', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ffffff'];

type Geometry = { width: number; height: number; rotation: number };

let seq = 0;
const nextId = () => `a-${++seq}`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function PdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);
  const [page, setPage] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [color, setColor] = useState('#dc2626');
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [font, setFont] = useState<AnnotationFontKey>('Helvetica');
  const [opacity, setOpacity] = useState(1);

  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<string | null>(null);
  const drafting = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const moving = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  const pageGeometry = geometry[page];
  const viewPt = useMemo(
    () => (pageGeometry ? renderedSize(pageGeometry.width, pageGeometry.height, pageGeometry.rotation) : null),
    [pageGeometry]
  );

  /** Points → on-screen pixels for the page currently displayed. */
  const ptToPx = viewPt && stage.height ? stage.height / viewPt.height : 1;

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === page),
    [annotations, page]
  );
  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId]
  );

  const commit = useCallback((updater: (prev: Annotation[]) => Annotation[]) => {
    setAnnotations((prev) => {
      setHistory((h) => [...h.slice(-49), prev]);
      setFuture([]);
      return updater(prev);
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setAnnotations((current) => {
        setFuture((f) => [current, ...f.slice(0, 49)]);
        return previous;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setAnnotations((current) => {
        setHistory((h) => [...h, current]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setPage(0);
    setAnnotations([]);
    setHistory([]);
    setFuture([]);
    setGeometry([]);
    try {
      setGeometry(await getPageGeometry(next));
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
    if (!point || !viewPt) return;

    if (tool === 'select') {
      setSelectedId(null);
      return;
    }

    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const id = nextId();
    const base = { id, page, opacity };

    if (tool === 'text') {
      commit((prev) => [
        ...prev,
        { ...base, kind: 'text', x: point.x, y: point.y, text: 'Double-click to edit', size: fontSize, font, color },
      ]);
      setSelectedId(id);
      setTool('select');
      return;
    }

    if (tool === 'image') {
      const dataUrl = pendingImage.current;
      if (!dataUrl) {
        imageInputRef.current?.click();
        return;
      }
      commit((prev) => [
        ...prev,
        { ...base, kind: 'image', x: point.x, y: point.y, width: 0.25, height: 0.18, dataUrl },
      ]);
      pendingImage.current = null;
      setSelectedId(id);
      setTool('select');
      return;
    }

    drafting.current = { id, startX: point.x, startY: point.y };

    if (tool === 'draw') {
      commit((prev) => [...prev, { ...base, kind: 'draw', points: [point], strokeColor: color, strokeWidth }]);
    } else if (tool === 'line' || tool === 'arrow') {
      commit((prev) => [
        ...prev,
        { ...base, kind: tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y, strokeColor: color, strokeWidth },
      ]);
    } else {
      commit((prev) => [
        ...prev,
        {
          ...base,
          kind: tool,
          x: point.x, y: point.y, width: 0, height: 0,
          strokeColor: color,
          fillColor: tool === 'highlight' ? color : fillColor,
          strokeWidth,
          opacity: tool === 'highlight' ? Math.min(opacity, 0.35) : opacity,
        },
      ]);
    }
    setSelectedId(id);
  }, [tool, pointOf, viewPt, page, opacity, fontSize, font, color, fillColor, strokeWidth, commit]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const point = pointOf(event);
    if (!point) return;

    if (moving.current) {
      const { id, lastX, lastY } = moving.current;
      const dx = point.x - lastX;
      const dy = point.y - lastY;
      moving.current = { id, lastX: point.x, lastY: point.y };
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          if (a.kind === 'draw') return { ...a, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
          if (a.kind === 'line' || a.kind === 'arrow') {
            return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
          }
          if (a.kind === 'text' || a.kind === 'image' || a.kind === 'rect' || a.kind === 'ellipse' || a.kind === 'highlight') {
            return { ...a, x: a.x + dx, y: a.y + dy };
          }
          return a;
        })
      );
      return;
    }

    const draft = drafting.current;
    if (!draft) return;

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== draft.id) return a;
        if (a.kind === 'draw') {
          const last = a.points[a.points.length - 1];
          if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.002) return a;
          return { ...a, points: [...a.points, point] };
        }
        if (a.kind === 'line' || a.kind === 'arrow') return { ...a, x2: point.x, y2: point.y };
        if (a.kind === 'rect' || a.kind === 'ellipse' || a.kind === 'highlight') {
          return {
            ...a,
            x: Math.min(draft.startX, point.x),
            y: Math.min(draft.startY, point.y),
            width: Math.abs(point.x - draft.startX),
            height: Math.abs(point.y - draft.startY),
          };
        }
        return a;
      })
    );
  }, [pointOf]);

  const onPointerUp = useCallback(() => {
    const draft = drafting.current;
    drafting.current = null;
    moving.current = null;
    if (!draft) return;

    // Discard accidental zero-size shapes.
    setAnnotations((prev) =>
      prev.filter((a) => {
        if (a.id !== draft.id) return true;
        if (a.kind === 'rect' || a.kind === 'ellipse' || a.kind === 'highlight') {
          return a.width > 0.004 && a.height > 0.004;
        }
        if (a.kind === 'line' || a.kind === 'arrow') {
          return Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 0.006;
        }
        if (a.kind === 'draw') return a.points.length > 1;
        return true;
      })
    );
    setTool((current) => (current === 'draw' ? current : 'select'));
  }, []);

  const startMove = useCallback((event: React.PointerEvent, id: string) => {
    if (tool !== 'select') return;
    event.stopPropagation();
    const point = pointOf(event);
    if (!point) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelectedId(id);
    setHistory((h) => [...h.slice(-49), annotations]);
    setFuture([]);
    moving.current = { id, lastX: point.x, lastY: point.y };
  }, [tool, pointOf, annotations]);

  const patch = useCallback((id: string, changes: Partial<Annotation>) => {
    setAnnotations((prev) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prev.map((a) => (a.id === id ? ({ ...a, ...changes } as any) : a))
    );
  }, []);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    commit((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, commit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeSelected();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, removeSelected, undo, redo]);

  const pickImage = useCallback((files: FileList | null) => {
    const image = files?.[0];
    if (!image) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage.current = String(reader.result);
      setTool('image');
    };
    reader.readAsDataURL(image);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await applyAnnotations(file, annotations));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes');
    } finally {
      setBusy(false);
    }
  }, [file, annotations]);

  const reset = useCallback(() => {
    setFile(null);
    setGeometry([]);
    setAnnotations([]);
    setHistory([]);
    setFuture([]);
    setResult(null);
    setError(null);
    setSelectedId(null);
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
        title="Changes saved"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Edit another PDF"
      />
    );
  }

  const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

  return (
    <div className="space-y-6">
      <FileBar
        file={file}
        detail={`${geometry.length || '…'} pages · ${annotations.length} edit${annotations.length === 1 ? '' : 's'}`}
        onChange={reset}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
        {TOOLS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              if (t.value === 'image') { imageInputRef.current?.click(); return; }
              setTool(t.value);
            }}
            title={t.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              tool === t.value ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{t.icon}</svg>
          </button>
        ))}

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files); e.target.value = ''; }} />

        <div className="w-px h-8 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              onClick={() => {
                setColor(swatch);
                if (selected) patch(selected.id, { ...(selected.kind === 'text' ? { color: swatch } : { strokeColor: swatch }) } as Partial<Annotation>);
              }}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === swatch ? 'border-slate-900' : 'border-white ring-1 ring-slate-200'}`}
              style={{ background: swatch }}
              title={swatch}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-slate-200 bg-white" />
        </div>

        <div className="w-px h-8 bg-slate-200 mx-1" />

        <button onClick={undo} disabled={history.length === 0} className="px-3 h-10 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40">
          Undo
        </button>
        <button onClick={redo} disabled={future.length === 0} className="px-3 h-10 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40">
          Redo
        </button>
        <button
          onClick={() => commit(() => [])}
          disabled={annotations.length === 0}
          className="px-3 h-10 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        {/* Canvas */}
        <div className="flex flex-col items-center gap-4">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`relative w-full max-w-2xl touch-none ${tool === 'select' ? '' : 'cursor-crosshair'}`}
          >
            <PageStage
              file={file}
              pageIndex={page}
              scale={1.6}
              onSize={setStage}
              overlay={
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  style={{ pointerEvents: 'none' }}
                >
                  {pageAnnotations.map((a) => {
                    const isSelected = a.id === selectedId;
                    const stroke = 'strokeColor' in a ? a.strokeColor : '#000';
                    const widthUnits = 'strokeWidth' in a ? (a.strokeWidth * ptToPx * 1000) / (stage.width || 1) : 1;

                    if (a.kind === 'rect' || a.kind === 'highlight') {
                      return (
                        <rect
                          key={a.id}
                          x={a.x * 1000} y={a.y * 1000} width={a.width * 1000} height={a.height * 1000}
                          fill={a.fillColor ?? 'none'}
                          fillOpacity={a.fillColor ? a.opacity : 0}
                          stroke={a.kind === 'highlight' ? 'none' : stroke}
                          strokeOpacity={a.opacity}
                          strokeWidth={widthUnits}
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: 'all', cursor: tool === 'select' ? 'move' : 'crosshair' }}
                          onPointerDown={(e) => startMove(e, a.id)}
                          strokeDasharray={isSelected ? '6 4' : undefined}
                        />
                      );
                    }
                    if (a.kind === 'ellipse') {
                      return (
                        <ellipse
                          key={a.id}
                          cx={(a.x + a.width / 2) * 1000} cy={(a.y + a.height / 2) * 1000}
                          rx={(a.width / 2) * 1000} ry={(a.height / 2) * 1000}
                          fill={a.fillColor ?? 'none'}
                          fillOpacity={a.fillColor ? a.opacity : 0}
                          stroke={stroke}
                          strokeOpacity={a.opacity}
                          strokeWidth={widthUnits}
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: 'all', cursor: tool === 'select' ? 'move' : 'crosshair' }}
                          onPointerDown={(e) => startMove(e, a.id)}
                          strokeDasharray={isSelected ? '6 4' : undefined}
                        />
                      );
                    }
                    if (a.kind === 'line' || a.kind === 'arrow') {
                      return (
                        <g key={a.id} style={{ pointerEvents: 'all', cursor: tool === 'select' ? 'move' : 'crosshair' }} onPointerDown={(e) => startMove(e, a.id)}>
                          <line
                            x1={a.x1 * 1000} y1={a.y1 * 1000} x2={a.x2 * 1000} y2={a.y2 * 1000}
                            stroke={stroke} strokeOpacity={a.opacity}
                            strokeWidth={widthUnits} strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {a.kind === 'arrow' && (() => {
                            const angle = Math.atan2((a.y2 - a.y1) * 1000, (a.x2 - a.x1) * 1000);
                            const head = 18;
                            const wing = (sign: number) => ({
                              x: a.x2 * 1000 - head * Math.cos(angle - sign * Math.PI / 7),
                              y: a.y2 * 1000 - head * Math.sin(angle - sign * Math.PI / 7),
                            });
                            const w1 = wing(1);
                            const w2 = wing(-1);
                            return (
                              <>
                                <line x1={a.x2 * 1000} y1={a.y2 * 1000} x2={w1.x} y2={w1.y} stroke={stroke} strokeOpacity={a.opacity} strokeWidth={widthUnits} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                                <line x1={a.x2 * 1000} y1={a.y2 * 1000} x2={w2.x} y2={w2.y} stroke={stroke} strokeOpacity={a.opacity} strokeWidth={widthUnits} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                              </>
                            );
                          })()}
                          {isSelected && (
                            <circle cx={a.x2 * 1000} cy={a.y2 * 1000} r={8} fill="none" stroke="#10b981" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                          )}
                        </g>
                      );
                    }
                    if (a.kind === 'draw') {
                      const d = a.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * 1000} ${p.y * 1000}`).join(' ');
                      return (
                        <path
                          key={a.id}
                          d={d}
                          fill="none"
                          stroke={stroke}
                          strokeOpacity={a.opacity}
                          strokeWidth={widthUnits}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: 'all', cursor: tool === 'select' ? 'move' : 'crosshair' }}
                          onPointerDown={(e) => startMove(e, a.id)}
                        />
                      );
                    }
                    return null;
                  })}
                </svg>
              }
            >
              {/* Text and image layers sit above the SVG so they stay crisp. */}
              {pageAnnotations.map((a) => {
                if (a.kind === 'text') {
                  return (
                    <div
                      key={a.id}
                      onPointerDown={(e) => startMove(e, a.id)}
                      className={`absolute whitespace-pre leading-tight ${a.id === selectedId ? 'ring-2 ring-emerald-400 ring-offset-1' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}
                      style={{
                        left: pct(a.x),
                        top: pct(a.y),
                        color: a.color,
                        opacity: a.opacity,
                        fontSize: `${a.size * ptToPx}px`,
                        fontFamily: a.font.startsWith('Times') ? 'Times, serif' : a.font.startsWith('Courier') ? 'monospace' : 'Helvetica, Arial, sans-serif',
                        fontWeight: a.font.includes('Bold') ? 700 : 400,
                        fontStyle: a.font.includes('Italic') || a.font.includes('Oblique') ? 'italic' : 'normal',
                        pointerEvents: 'all',
                      }}
                    >
                      {a.text}
                    </div>
                  );
                }
                if (a.kind === 'image') {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.id}
                      src={a.dataUrl}
                      alt="Added"
                      draggable={false}
                      onPointerDown={(e) => startMove(e, a.id)}
                      className={`absolute select-none ${a.id === selectedId ? 'ring-2 ring-emerald-400' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}
                      style={{
                        left: pct(a.x),
                        top: pct(a.y),
                        width: pct(a.width),
                        height: pct(a.height),
                        opacity: a.opacity,
                        pointerEvents: 'all',
                      }}
                    />
                  );
                }
                return null;
              })}
            </PageStage>
          </div>

          <PageNavigator page={page} total={geometry.length || 1} onChange={(next) => { setPage(next); setSelectedId(null); }} />
        </div>

        {/* Inspector */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {selected ? `Selected: ${selected.kind}` : 'Tool settings'}
            </h3>

            {selected?.kind === 'text' && (
              <Field label="Text">
                <textarea
                  value={selected.text}
                  onChange={(e) => patch(selected.id, { text: e.target.value } as Partial<Annotation>)}
                  rows={3}
                  className={inputClass}
                />
              </Field>
            )}

            {(!selected || selected.kind === 'text') && (
              <>
                <Field label="Font">
                  <select
                    value={selected?.kind === 'text' ? selected.font : font}
                    onChange={(e) => {
                      const value = e.target.value as AnnotationFontKey;
                      setFont(value);
                      if (selected?.kind === 'text') patch(selected.id, { font: value } as Partial<Annotation>);
                    }}
                    className={inputClass}
                  >
                    {FONT_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </Field>
                <Field label={`Font size — ${selected?.kind === 'text' ? selected.size : fontSize}pt`}>
                  <input
                    type="range" min={6} max={72}
                    value={selected?.kind === 'text' ? selected.size : fontSize}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFontSize(value);
                      if (selected?.kind === 'text') patch(selected.id, { size: value } as Partial<Annotation>);
                    }}
                    className="w-full accent-emerald-500"
                  />
                </Field>
              </>
            )}

            {(!selected || selected.kind !== 'text') && (
              <Field label={`Stroke width — ${selected && 'strokeWidth' in selected ? selected.strokeWidth : strokeWidth}pt`}>
                <input
                  type="range" min={0.5} max={16} step={0.5}
                  value={selected && 'strokeWidth' in selected ? selected.strokeWidth : strokeWidth}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setStrokeWidth(value);
                    if (selected && 'strokeWidth' in selected) patch(selected.id, { strokeWidth: value } as Partial<Annotation>);
                  }}
                  className="w-full accent-emerald-500"
                />
              </Field>
            )}

            <Field label={`Opacity — ${Math.round((selected?.opacity ?? opacity) * 100)}%`}>
              <input
                type="range" min={5} max={100}
                value={Math.round((selected?.opacity ?? opacity) * 100)}
                onChange={(e) => {
                  const value = Number(e.target.value) / 100;
                  setOpacity(value);
                  if (selected) patch(selected.id, { opacity: value } as Partial<Annotation>);
                }}
                className="w-full accent-emerald-500"
              />
            </Field>

            {(!selected || selected.kind === 'rect' || selected.kind === 'ellipse') && (
              <Field label="Fill">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const value = fillColor ? null : color;
                      setFillColor(value);
                      if (selected && (selected.kind === 'rect' || selected.kind === 'ellipse')) {
                        patch(selected.id, { fillColor: selected.fillColor ? null : color } as Partial<Annotation>);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    {(selected && (selected.kind === 'rect' || selected.kind === 'ellipse') ? selected.fillColor : fillColor) ? 'Remove fill' : 'Add fill'}
                  </button>
                  <span className="text-xs text-slate-400">Outline only by default</span>
                </div>
              </Field>
            )}

            {selected && (
              <button onClick={removeSelected} className="w-full py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold">
                Delete selection
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">This page</h3>
            {pageAnnotations.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing added yet. Pick a tool and draw on the page.</p>
            ) : (
              <ul className="space-y-1 max-h-52 overflow-y-auto">
                {pageAnnotations.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        a.id === selectedId ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {a.kind === 'text' ? `“${a.text.slice(0, 24)}”` : a.kind}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ErrorBox message={error} />

      <Section title="Export">
        <PrimaryButton onClick={run} busy={busy} disabled={annotations.length === 0}>
          Save edited PDF
        </PrimaryButton>
      </Section>
    </div>
  );
}
