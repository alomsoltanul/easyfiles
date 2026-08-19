'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ANNOTATION_FONTS,
  type Annotation,
  type AnnotationFontKey,
} from '@/lib/pdf-annotate';
import { finalizeEdit, type ExportMode } from '@/lib/pdf-edit-export';
import { renderedSize } from '@/lib/pdf-common';
import { getPageGeometry, renderPDFThumbnails } from '@/lib/pdf-render';
import {
  ASCENT_RATIO,
  extractPageTextLayer,
  forgetTextLayerCache,
  layoutBlocks,
  type BlockEdit,
  type LiveBlock,
  type PageTextLayer,
} from '@/lib/pdf-text-layer';
import {
  getTextMetrics,
  isBoldFont,
  isItalicFont,
  restyleFont,
  unsupportedGlyphs,
  type TextAlign,
  type TextMetrics,
} from '@/lib/pdf-text-metrics';
import { formatFileSize } from '@/lib/converters';
import { PageStage, downloadBlob } from './pdf/shared';
import TextBlockLayer from './pdf/TextBlockLayer';

/* ------------------------------------------------------------------ */
/* Types + constants                                                   */
/* ------------------------------------------------------------------ */

type Tool = 'edittext' | 'select' | 'text' | 'draw' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'highlight' | 'image';

const SHAPE_TOOLS: { value: Tool; label: string }[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'line', label: 'Line' },
  { value: 'arrow', label: 'Arrow' },
];

const TOOL_HINT: Record<Tool, string> = {
  edittext: 'Click any sentence, heading or table cell to retype it. The rest of the column reflows as you type.',
  select: 'Click an object to select it. Drag to move, Delete to remove.',
  text: 'Click on the page to drop a text box, then edit it on the right.',
  draw: 'Drag to draw freehand. Stays vector at any zoom.',
  rect: 'Drag to draw a rectangle. Add a fill on the right.',
  ellipse: 'Drag to draw an ellipse.',
  line: 'Drag from start to end.',
  arrow: 'Drag from tail to head.',
  highlight: 'Drag over text to lay a translucent marker over it.',
  image: 'Pick an image, then click the page to place it.',
};

const FONT_KEYS = Object.keys(ANNOTATION_FONTS) as AnnotationFontKey[];

const SWATCHES = ['#201e1d', '#ec3013', '#605d5d', '#1d4ed8', '#047857', '#ca8a04', '#ffffff'];

const OBJECT_NAMES: Record<string, string> = {
  text: 'Text', image: 'Image', draw: 'Drawing', rect: 'Rectangle',
  ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow', highlight: 'Highlight',
  textblock: 'Document text',
};

const ALIGNMENTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

const MORE_TOOLS = [
  { label: 'Redact', href: '/pdf/redact', d: 'M3 10h18v5H3z' },
  { label: 'Sign', href: '/pdf/sign', d: 'M3 18c4 0 5-12 9-12s2 9 6 9 3-3 3-3' },
  { label: 'OCR', href: '/pdf/ocr', d: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M8 12h8' },
  { label: 'Organize', href: '/pdf/organize', d: 'M4 6h16M4 10h16M4 14h10M4 18h10' },
];

type Geometry = { width: number; height: number; rotation: number };

/** One undo step. Retyped text and drawn objects move together. */
type Snapshot = { annotations: Annotation[]; edits: Record<string, BlockEdit> };

let seq = 0;
const nextId = () => `a-${++seq}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Icon({ d, size = 18, fill = 'none', width = 1.8 }: { d: string; size?: number; fill?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={width}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#605d5d]">{children}</span>
  );
}

const fieldClass =
  'w-full border border-[#bab6b6] bg-white px-2.5 py-2 text-[13px] text-[#201e1d] focus:border-[#201e1d] focus:outline-none';

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export default function PdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [tool, setTool] = useState<Tool>('edittext');
  const [shapeTool, setShapeTool] = useState<Tool>('rect');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The document's own text, rebuilt as editable blocks — see pdf-text-layer.
  const [metrics, setMetrics] = useState<TextMetrics | null>(null);
  const [layers, setLayers] = useState<Record<number, PageTextLayer>>({});
  const [readingText, setReadingText] = useState(false);
  const [blockEdits, setBlockEdits] = useState<Record<string, BlockEdit>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [reflow, setReflow] = useState(true);

  const [color, setColor] = useState('#ec3013');
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [font, setFont] = useState<AnnotationFontKey>('Helvetica');
  const [opacity, setOpacity] = useState(1);

  const [zoom, setZoom] = useState(1);
  const [stage, setStage] = useState({ width: 0, height: 0 });

  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('editable');
  const [exportName, setExportName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const pendingImage = useRef<string | null>(null);
  const drafting = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const moving = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  const pageGeometry = geometry[page];
  const viewPt = useMemo(
    () => (pageGeometry ? renderedSize(pageGeometry.width, pageGeometry.height, pageGeometry.rotation) : null),
    [pageGeometry]
  );
  const ptToPx = viewPt && stage.height ? stage.height / viewPt.height : 1;

  const pageAnnotations = useMemo(() => annotations.filter((a) => a.page === page), [annotations, page]);
  const selected = useMemo(() => annotations.find((a) => a.id === selectedId) ?? null, [annotations, selectedId]);
  const position = pageOrder.indexOf(page);

  /* ---------------------------------------------------------- history */

  // Undo has to restore drawn objects and retyped text together, so both live
  // in one snapshot. A ref keeps the "state before this change" cheap to read
  // from inside event handlers.
  const live = useRef<Snapshot>({ annotations: [], edits: {} });
  useEffect(() => { live.current = { annotations, edits: blockEdits }; }, [annotations, blockEdits]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), live.current]);
    setFuture([]);
  }, []);

  const commit = useCallback((updater: (prev: Annotation[]) => Annotation[]) => {
    pushHistory();
    setAnnotations(updater);
  }, [pushHistory]);

  const commitEdits = useCallback((updater: (prev: Record<string, BlockEdit>) => Record<string, BlockEdit>) => {
    pushHistory();
    setBlockEdits(updater);
  }, [pushHistory]);

  const restore = useCallback((snapshot: Snapshot) => {
    setAnnotations(snapshot.annotations);
    setBlockEdits(snapshot.edits);
    setSelectedId(null);
    setEditingBlockId(null);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setFuture((f) => [live.current, ...f.slice(0, 49)]);
      restore(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, [restore]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      setHistory((h) => [...h, live.current]);
      restore(f[0]);
      return f.slice(1);
    });
  }, [restore]);

  /* ------------------------------------------------------------ file */

  const openFile = useCallback(async (next: File | undefined | null) => {
    if (!next) return;
    if (!/\.pdf$/i.test(next.name) && next.type !== 'application/pdf') {
      setError('That is not a PDF. Pick a .pdf file.');
      return;
    }
    forgetTextLayerCache();
    setFile(next);
    setError(null);
    setExported(false);
    setPage(0);
    setAnnotations([]);
    setHistory([]);
    setFuture([]);
    setGeometry([]);
    setThumbs([]);
    setSelectedId(null);
    setLayers({});
    setBlockEdits({});
    setActiveBlockId(null);
    setEditingBlockId(null);
    setZoom(1);
    setExportName(next.name.replace(/\.pdf$/i, '') + '-edited.pdf');
    setLoading(true);
    try {
      const geo = await getPageGeometry(next);
      setGeometry(geo);
      setPageOrder(geo.map((_, i) => i));
      setLoading(false);
      setThumbs(await renderPDFThumbnails(next, 0.3));
    } catch {
      setLoading(false);
      setError('This PDF could not be read. It may be corrupt or password-protected.');
      setFile(null);
    }
  }, []);

  const reset = useCallback(() => {
    forgetTextLayerCache();
    setFile(null);
    setGeometry([]);
    setThumbs([]);
    setPageOrder([]);
    setAnnotations([]);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setLayers({});
    setBlockEdits({});
    setActiveBlockId(null);
    setEditingBlockId(null);
    setError(null);
    setExported(false);
    setPage(0);
  }, []);

  /* ------------------------------------------------------- text layer */

  useEffect(() => {
    let cancelled = false;
    getTextMetrics().then(
      (loaded) => { if (!cancelled) setMetrics(loaded); },
      () => { if (!cancelled) setError('Font metrics could not be loaded, so text editing is unavailable.'); }
    );
    return () => { cancelled = true; };
  }, []);

  // Reading the text layer means rendering the page and clustering every glyph,
  // so it happens per page, on demand, the first time it is needed.
  useEffect(() => {
    if (!file || tool !== 'edittext' || layers[page]) return;
    let cancelled = false;
    setReadingText(true);
    extractPageTextLayer(file, page).then(
      (layer) => {
        if (cancelled) return;
        setLayers((prev) => ({ ...prev, [page]: layer }));
        setReadingText(false);
      },
      () => {
        if (cancelled) return;
        setLayers((prev) => ({ ...prev, [page]: { blocks: [], scanned: true } }));
        setReadingText(false);
      }
    );
    return () => { cancelled = true; };
  }, [file, tool, page, layers]);

  useEffect(() => {
    setActiveBlockId(null);
    setEditingBlockId(null);
  }, [page]);

  const liveBlocks = useMemo<LiveBlock[]>(() => {
    const layer = layers[page];
    if (!layer || !metrics) return [];
    return layoutBlocks(layer.blocks, blockEdits, metrics, reflow);
  }, [layers, page, metrics, blockEdits, reflow]);

  /**
   * Every page's retyped text, as annotations the writer understands. Only
   * blocks that changed — or that a change pushed out of place — are included;
   * everything else keeps the document's original ink.
   */
  const textAnnotations = useMemo<Annotation[]>(() => {
    if (!metrics) return [];
    const out: Annotation[] = [];
    for (const [key, layer] of Object.entries(layers)) {
      const index = Number(key);
      // A page nobody has touched cannot have a moved or rewritten block, so
      // there is no reason to re-wrap it on every keystroke.
      if (!layer.blocks.some((block) => blockEdits[block.id])) continue;
      for (const item of layoutBlocks(layer.blocks, blockEdits, metrics, reflow)) {
        if (!item.managed) continue;
        out.push({
          id: `tb:${item.block.id}`,
          page: index,
          kind: 'textblock',
          cover: item.block.cover,
          background: item.background,
          box: { x: item.block.x, top: item.block.top + item.shift, width: item.block.width },
          text: item.removed ? '' : item.text,
          size: item.size,
          font: item.font,
          color: item.color,
          lineHeight: item.lineHeight,
          align: item.align,
          ascent: item.size * ASCENT_RATIO,
          anchors: item.block.glyphs,
          opacity: 1,
        });
      }
    }
    return out;
  }, [layers, blockEdits, metrics, reflow]);

  const activeBlock = useMemo(
    () => liveBlocks.find((item) => item.block.id === activeBlockId) ?? null,
    [liveBlocks, activeBlockId]
  );

  const patchBlock = useCallback((id: string, change: BlockEdit, history = true) => {
    const apply = (prev: Record<string, BlockEdit>) => ({ ...prev, [id]: { ...prev[id], ...change } });
    if (history) commitEdits(apply);
    else setBlockEdits(apply);
  }, [commitEdits]);

  const openBlock = useCallback((id: string) => {
    setSelectedId(null);
    setActiveBlockId(id);
    setEditingBlockId(id);
    pushHistory();
  }, [pushHistory]);

  const resetBlock = useCallback((id: string) => {
    commitEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [commitEdits]);

  /* -------------------------------------------------------- pointers */

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

    if (tool === 'edittext') {
      setActiveBlockId(null);
      setEditingBlockId(null);
      return;
    }

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
        { ...base, kind: 'text', x: point.x, y: point.y, text: 'New text', size: fontSize, font, color },
      ]);
      setSelectedId(id);
      setTool('select');
      setTimeout(() => {
        textAreaRef.current?.focus();
        textAreaRef.current?.select();
      }, 0);
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

    // Drop accidental zero-size shapes.
    setAnnotations((prev) =>
      prev.filter((a) => {
        if (a.id !== draft.id) return true;
        if (a.kind === 'rect' || a.kind === 'ellipse' || a.kind === 'highlight') return a.width > 0.004 && a.height > 0.004;
        if (a.kind === 'line' || a.kind === 'arrow') return Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 0.006;
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
    pushHistory();
    moving.current = { id, lastX: point.x, lastY: point.y };
  }, [tool, pointOf, pushHistory]);

  /* --------------------------------------------------------- editing */

  const patch = useCallback((id: string, changes: Partial<Annotation>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAnnotations((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...changes } as any) : a)));
  }, []);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    commit((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, commit]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const id = nextId();
    const shift = 0.02;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: any = { ...selected, id };
    if (copy.kind === 'draw') copy.points = copy.points.map((p: { x: number; y: number }) => ({ x: p.x + shift, y: p.y + shift }));
    else if (copy.kind === 'line' || copy.kind === 'arrow') {
      copy.x1 += shift; copy.y1 += shift; copy.x2 += shift; copy.y2 += shift;
    } else { copy.x += shift; copy.y += shift; }
    commit((prev) => [...prev, copy as Annotation]);
    setSelectedId(id);
  }, [selected, commit]);

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeSelected();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && activeBlockId) {
        event.preventDefault();
        patchBlock(activeBlockId, { removed: true });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (event.key === 'Enter' && activeBlockId && !editingBlockId) {
        event.preventDefault();
        openBlock(activeBlockId);
      } else if (event.key === 'Escape') {
        setSelectedId(null);
        setEditingBlockId(null);
        setActiveBlockId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, removeSelected, undo, redo, activeBlockId, editingBlockId, patchBlock, openBlock]);

  /* ----------------------------------------------------------- pages */

  const movePage = useCallback((original: number, delta: number) => {
    setPageOrder((prev) => {
      const index = prev.indexOf(original);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const dropPage = useCallback((original: number) => {
    setPageOrder((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p !== original);
      setPage((current) => (current === original ? next[0] : current));
      return next;
    });
    setAnnotations((prev) => prev.filter((a) => a.page !== original));
    setBlockEdits((prev) => {
      const ids = new Set((layers[original]?.blocks ?? []).map((block) => block.id));
      if (ids.size === 0) return prev;
      const next: Record<string, BlockEdit> = {};
      for (const [id, edit] of Object.entries(prev)) if (!ids.has(id)) next[id] = edit;
      return next;
    });
    setActiveBlockId(null);
    setEditingBlockId(null);
  }, [layers]);

  /* ---------------------------------------------------------- export */

  const runExport = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const name = exportName.trim().replace(/(\.pdf)?$/i, '.pdf') || 'edited.pdf';
      const blob = await finalizeEdit({
        file,
        annotations: [...textAnnotations, ...annotations],
        pageOrder,
        totalPages: geometry.length,
        mode: exportMode,
        name,
        onProgress: setProgress,
      });
      downloadBlob(blob, name);
      setExported(true);
      setShowExport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write the edited PDF');
    } finally {
      setBusy(false);
    }
  }, [file, annotations, textAnnotations, pageOrder, geometry.length, exportMode, exportName]);

  const pct = (n: number) => `${(n * 100).toFixed(4)}%`;
  const rewrites = textAnnotations.length;
  const editCount = annotations.length + rewrites;
  const dirty = editCount > 0 || pageOrder.length !== geometry.length;

  /* ------------------------------------------------------------------ */
  /* Upload view                                                         */
  /* ------------------------------------------------------------------ */

  if (!file) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ec3013]">PDF · Edit</p>
        <h1 className="mt-2.5 max-w-3xl text-[38px] font-extrabold leading-[1.03] tracking-[-0.02em] sm:text-[56px]">
          Edit the words already in your PDF.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#605d5d] sm:text-base">
          Click a sentence, a heading or a table cell and retype it. The old words are erased, the new ones are set in
          their place, and the rest of the column flows around them — just like a word processor. Everything runs in
          your browser; the file never leaves this device.
        </p>

        <div className="my-8 h-0.5 bg-[#201e1d]" />

        {error && (
          <div className="mb-6 border-l-4 border-[#ec3013] bg-[#fff2ef] px-4 py-3 text-sm font-semibold text-[#7c1405]">
            {error}
          </div>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div
            onClick={() => uploadInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); openFile(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-start gap-3.5 border-2 border-dashed border-[#201e1d] bg-[#f8f4f4] px-8 py-12 transition-colors hover:bg-[#fff2ef] sm:px-10 sm:py-14"
          >
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            <span className="text-[#ec3013]">
              <Icon d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 7.5L12 3m0 0l4.5 4.5M12 3v13.5" size={40} />
            </span>
            <p className="text-2xl font-extrabold tracking-[-0.01em]">Drop a PDF here</p>
            <p className="text-sm text-[#605d5d]">or click to browse — nothing is uploaded</p>
            <span className="mt-2 inline-flex items-center gap-2.5 bg-[#ec3013] px-4.5 py-3 text-sm font-bold text-white">
              Open document
              <Icon d="M9 5l7 7-7 7" size={16} width={2.4} />
            </span>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">What you can do</p>
            <div className="border-t-2 border-[#201e1d]">
              {[
                ['Rewrite existing text', 'Retype any paragraph, heading or label in place'],
                ['Delete text', 'Erase words from the page, background colour matched'],
                ['Columns & tables', 'Cells and columns re-wrap and push each other along'],
                ['Add text & images', 'New text boxes, logos and photos anywhere'],
                ['Draw & mark up', 'Freehand, shapes, arrows, translucent highlighter'],
                ['Pages', 'Reorder or delete pages before you export'],
              ].map(([title, body]) => (
                <div key={title} className="flex items-start gap-3 border-b border-[#d7d3d3] py-3.5">
                  <span className="mt-0.5 text-[#201e1d]"><Icon d="M5 13l4 4L19 7" size={16} width={2.4} /></span>
                  <span>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="block text-xs text-[#7d7979]">{body}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-px border border-[#d7d3d3] bg-[#d7d3d3]">
              <div className="bg-[#f3f2f2] p-4">
                <p className="text-2xl font-extrabold">100%</p>
                <p className="mt-1 text-xs text-[#605d5d]">in-browser, no upload</p>
              </div>
              <div className="bg-[#f3f2f2] p-4">
                <p className="text-2xl font-extrabold">10</p>
                <p className="mt-1 text-xs text-[#605d5d]">editing tools</p>
              </div>
            </div>

            <div className="mt-7">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">Related tools</p>
              <div className="flex flex-wrap gap-2">
                {MORE_TOOLS.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="border-2 border-[#201e1d] px-3 py-2 text-xs font-bold transition-colors hover:bg-[#201e1d] hover:text-[#f3f2f2]"
                  >
                    {t.label} PDF
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Editor view                                                         */
  /* ------------------------------------------------------------------ */

  const railButton = (value: Tool, label: string, d: string, filled = false) => {
    const active = tool === value || (value === shapeTool && SHAPE_TOOLS.some((s) => s.value === tool) && tool === shapeTool);
    return (
      <button
        key={value}
        onClick={() => {
          if (value === 'image') { imageInputRef.current?.click(); return; }
          setTool(value);
        }}
        className={`flex w-full items-center gap-2 px-2.5 py-2.5 text-left transition-colors ${
          active ? 'bg-[#201e1d] text-[#f3f2f2]' : 'hover:bg-[#eae7e7]'
        }`}
      >
        <Icon d={d} fill={filled ? 'currentColor' : 'none'} />
        <span className="text-xs font-bold">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-68px)] min-h-[560px] flex-col">
      {/* Top bar */}
      <div className="flex h-14 flex-none items-center gap-3 border-b-2 border-[#201e1d] px-3">
        <button onClick={reset} title="Close document" className="p-2 hover:bg-[#eae7e7]">
          <Icon d="M15 5l-7 7 7 7" width={2.2} size={16} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-[-0.01em]">{file.name}</p>
          <p className="mt-px text-[11px] text-[#7d7979]">
            {formatFileSize(file.size)} · {pageOrder.length} page{pageOrder.length === 1 ? '' : 's'} · {editCount} edit
            {editCount === 1 ? '' : 's'}
            {rewrites > 0 ? ` · ${rewrites} rewritten` : ''}
          </p>
        </div>

        <span className="ml-1.5 h-7 w-px bg-[#d7d3d3]" />
        <button onClick={undo} disabled={history.length === 0} title="Undo" className="p-2 hover:bg-[#eae7e7] disabled:opacity-30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h10a6 6 0 010 12h-3" />
          </svg>
        </button>
        <button onClick={redo} disabled={future.length === 0} title="Redo" className="p-2 hover:bg-[#eae7e7] disabled:opacity-30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 9H10a6 6 0 100 12h3" />
          </svg>
        </button>

        <span className="h-7 w-px bg-[#d7d3d3]" />
        <div className="flex items-center">
          <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} className="p-2 hover:bg-[#eae7e7]" title="Zoom out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M8 11h6M20 20l-4.5-4.5" />
            </svg>
          </button>
          <span className="w-12 text-center text-xs font-bold tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))} className="p-2 hover:bg-[#eae7e7]" title="Zoom in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M8 11h6M11 8v6M20 20l-4.5-4.5" />
            </svg>
          </button>
        </div>

        <span className="hidden h-7 w-px bg-[#d7d3d3] sm:block" />
        <span className="hidden text-xs font-bold tracking-[0.04em] sm:inline">
          Page {position + 1} / {pageOrder.length}
        </span>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className={`hidden text-[11px] font-bold uppercase tracking-[0.1em] sm:inline ${
              exported && !dirty ? 'text-[#7d7979]' : dirty ? 'text-[#ec3013]' : 'text-[#7d7979]'
            }`}
          >
            {exported && !dirty ? 'Exported' : dirty ? 'Unsaved edits' : 'No edits yet'}
          </span>
          <button
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-2 bg-[#ec3013] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#ae1800]"
          >
            <Icon d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" size={15} width={2.2} />
            Export
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Tool rail */}
        <div className="flex w-[118px] flex-none flex-col overflow-y-auto border-r-2 border-[#201e1d] py-2">
          <p className="mx-3 mb-2 mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">Tools</p>
          {railButton('edittext', 'Edit text', 'M4 7V5h11v2M9.5 5v11M7 16h5M15 12h5M17.5 12v8')}
          {railButton('select', 'Select', 'M3 3l7.5 18 2.5-7.5L20.5 11 3 3z')}
          {railButton('text', 'Text', 'M4 6V4h16v2M12 4v16M9 20h6')}
          {railButton('image', 'Image', 'M4 16l4-4 3 3 5-5 4 4M4 6h16v12H4z')}
          {railButton('draw', 'Draw', 'M3 21l3-1 11-11a2 2 0 10-3-3L3 17l-1 3 1 1z')}

          <button
            onClick={() => setTool(shapeTool)}
            className={`flex w-full items-center gap-2 px-2.5 py-2.5 text-left transition-colors ${
              SHAPE_TOOLS.some((s) => s.value === tool) ? 'bg-[#201e1d] text-[#f3f2f2]' : 'hover:bg-[#eae7e7]'
            }`}
          >
            <Icon d="M4 6h16v12H4z" />
            <span className="text-xs font-bold">Shape</span>
          </button>
          {SHAPE_TOOLS.some((s) => s.value === tool) && (
            <div className="mb-1 bg-[#eae9e9] px-1.5 py-1.5">
              {SHAPE_TOOLS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setShapeTool(s.value); setTool(s.value); }}
                  className={`block w-full px-2 py-1.5 text-left text-[11px] font-bold ${
                    tool === s.value ? 'bg-[#ec3013] text-white' : 'hover:bg-[#d7d3d3]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {railButton('highlight', 'Mark up', 'M4 14h16v5H4zM7 4h10v7H7z')}

          <div className="mx-2.5 my-2 h-px bg-[#d7d3d3]" />
          <p className="mx-3 mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">More</p>
          {MORE_TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-2.5 hover:bg-[#eae7e7]">
              <Icon d={t.d} />
              <span className="text-xs font-bold">{t.label}</span>
            </Link>
          ))}

          <div className="mt-auto px-2.5 pb-1 pt-3">
            <p className="text-[10px] leading-relaxed text-[#7d7979]">{TOOL_HINT[tool]}</p>
          </div>
        </div>

        {/* Pages */}
        <div className="hidden w-[152px] flex-none overflow-y-auto border-r border-[#d7d3d3] bg-[#eae9e9] px-2.5 py-3 md:block">
          <p className="mb-2.5 ml-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">Pages</p>
          {pageOrder.map((original, index) => {
            const count = annotations.filter((a) => a.page === original).length;
            const active = original === page;
            return (
              <div key={original} className="mb-3.5">
                <button
                  onClick={() => { setPage(original); setSelectedId(null); }}
                  className={`block w-full border-2 bg-white ${active ? 'border-[#ec3013]' : 'border-[#d7d3d3] hover:border-[#7d7979]'}`}
                >
                  {thumbs[original] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[original]} alt={`Page ${index + 1}`} className="block w-full" draggable={false} />
                  ) : (
                    <span className="block aspect-[1/1.414] w-full animate-pulse bg-[#eae7e7]" />
                  )}
                </button>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className={`px-1 text-[10px] font-bold ${active ? 'bg-[#ec3013] text-white' : 'text-[#605d5d]'}`}>{index + 1}</span>
                  <span className="flex-1 truncate text-[10px] text-[#7d7979]">{count > 0 ? `${count} edit${count === 1 ? '' : 's'}` : ''}</span>
                  <button onClick={() => movePage(original, -1)} title="Move up" disabled={index === 0} className="p-0.5 disabled:opacity-25">
                    <Icon d="M12 19V5M5 12l7-7 7 7" size={12} width={2.4} />
                  </button>
                  <button onClick={() => movePage(original, 1)} title="Move down" disabled={index === pageOrder.length - 1} className="p-0.5 disabled:opacity-25">
                    <Icon d="M12 5v14M5 12l7 7 7-7" size={12} width={2.4} />
                  </button>
                  <button onClick={() => dropPage(original)} title="Delete page" disabled={pageOrder.length === 1} className="p-0.5 disabled:opacity-25">
                    <Icon d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" size={12} width={2.2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex min-w-0 flex-1 flex-col items-center overflow-auto bg-[#eae9e9] p-6">
          {tool === 'edittext' && (
            <div className="mb-4 w-full max-w-[900px] border-l-4 border-[#201e1d] bg-white px-4 py-2.5 text-[12px] leading-snug">
              {readingText || !metrics ? (
                <span className="font-bold text-[#605d5d]">Reading the text on this page…</span>
              ) : layers[page]?.scanned ? (
                <span className="text-[#7c1405]">
                  <b>No text layer on this page.</b> It is a scan or an image, so there are no words to retype.{' '}
                  <Link href="/pdf/ocr" className="font-bold underline">Run OCR first</Link>, then come back.
                </span>
              ) : liveBlocks.length === 0 ? (
                <span className="font-bold text-[#605d5d]">Nothing editable found on this page.</span>
              ) : (
                <span className="text-[#605d5d]">
                  <b className="text-[#201e1d]">{liveBlocks.length} editable region{liveBlocks.length === 1 ? '' : 's'}</b> on this page
                  {liveBlocks.some((b) => b.block.cell) ? ', table cells included' : ''}. Click one to retype it — the rest of
                  the column reflows around it.
                  {rewrites > 0 ? <b className="text-[#ae1800]"> {rewrites} rewritten.</b> : ''}
                </span>
              )}
              {rewrites > 0 && liveBlocks.some((b) => b.wall) && (
                <span className="mt-1.5 block text-[#7c1405]">
                  Text below uses characters the standard PDF fonts cannot draw, so it has to stay where it is —
                  the column stops flowing there. Check nothing has run into it.
                </span>
              )}
            </div>
          )}
          {loading ? (
            <p className="mt-16 text-sm font-bold text-[#7d7979]">Reading document…</p>
          ) : (
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`relative h-fit touch-none ${tool === 'select' ? '' : 'cursor-crosshair'}`}
              style={{ width: `${Math.round(760 * zoom)}px`, maxWidth: '100%' }}
            >
              <PageStage
                file={file}
                pageIndex={page}
                scale={1.6}
                onSize={setStage}
                className="w-full shadow-[0_10px_28px_rgba(45,43,43,0.18)]"
                overlay={
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                    {pageAnnotations.map((a) => {
                      const isSelected = a.id === selectedId;
                      const stroke = 'strokeColor' in a ? a.strokeColor : '#000';
                      const widthUnits = 'strokeWidth' in a ? (a.strokeWidth * ptToPx * 1000) / (stage.width || 1) : 1;
                      const interactive = { pointerEvents: 'all' as const, cursor: tool === 'select' ? 'move' : 'crosshair' };

                      if (a.kind === 'rect' || a.kind === 'highlight') {
                        return (
                          <rect
                            key={a.id}
                            x={a.x * 1000} y={a.y * 1000} width={a.width * 1000} height={a.height * 1000}
                            fill={a.fillColor ?? 'none'} fillOpacity={a.fillColor ? a.opacity : 0}
                            stroke={a.kind === 'highlight' ? 'none' : stroke} strokeOpacity={a.opacity}
                            strokeWidth={widthUnits} vectorEffect="non-scaling-stroke"
                            style={interactive} onPointerDown={(e) => startMove(e, a.id)}
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
                            fill={a.fillColor ?? 'none'} fillOpacity={a.fillColor ? a.opacity : 0}
                            stroke={stroke} strokeOpacity={a.opacity}
                            strokeWidth={widthUnits} vectorEffect="non-scaling-stroke"
                            style={interactive} onPointerDown={(e) => startMove(e, a.id)}
                            strokeDasharray={isSelected ? '6 4' : undefined}
                          />
                        );
                      }
                      if (a.kind === 'line' || a.kind === 'arrow') {
                        return (
                          <g key={a.id} style={interactive} onPointerDown={(e) => startMove(e, a.id)}>
                            <line
                              x1={a.x1 * 1000} y1={a.y1 * 1000} x2={a.x2 * 1000} y2={a.y2 * 1000}
                              stroke={stroke} strokeOpacity={a.opacity} strokeWidth={widthUnits}
                              strokeLinecap="round" vectorEffect="non-scaling-stroke"
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
                            {isSelected && <circle cx={a.x2 * 1000} cy={a.y2 * 1000} r={8} fill="none" stroke="#ec3013" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                          </g>
                        );
                      }
                      if (a.kind === 'draw') {
                        return (
                          <path
                            key={a.id}
                            d={a.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * 1000} ${p.y * 1000}`).join(' ')}
                            fill="none" stroke={stroke} strokeOpacity={a.opacity} strokeWidth={widthUnits}
                            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            style={interactive} onPointerDown={(e) => startMove(e, a.id)}
                          />
                        );
                      }
                      return null;
                    })}
                  </svg>
                }
              >
                {pageGeometry && metrics && (
                  <TextBlockLayer
                    blocks={liveBlocks}
                    geometry={pageGeometry}
                    stage={stage}
                    ptToPx={ptToPx}
                    metrics={metrics}
                    activeId={activeBlockId}
                    editingId={editingBlockId}
                    interactive={tool === 'edittext'}
                    onActivate={openBlock}
                    onText={(id, text) => patchBlock(id, { text }, false)}
                    onDone={() => setEditingBlockId(null)}
                  />
                )}

                {pageAnnotations.map((a) => {
                  if (a.kind === 'text') {
                    return (
                      <div
                        key={a.id}
                        onPointerDown={(e) => startMove(e, a.id)}
                        onDoubleClick={() => { setSelectedId(a.id); textAreaRef.current?.focus(); }}
                        className={`absolute whitespace-pre leading-tight ${a.id === selectedId ? 'outline-2 outline-offset-2 outline-[#ec3013]' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}
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
                        alt="Placed"
                        draggable={false}
                        onPointerDown={(e) => startMove(e, a.id)}
                        className={`absolute select-none ${a.id === selectedId ? 'outline-2 outline-[#ec3013]' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}
                        style={{ left: pct(a.x), top: pct(a.y), width: pct(a.width), height: pct(a.height), opacity: a.opacity, pointerEvents: 'all' }}
                      />
                    );
                  }
                  return null;
                })}
              </PageStage>
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="hidden w-[296px] flex-none overflow-y-auto border-l-2 border-[#201e1d] xl:block">
          <div className="border-b border-[#d7d3d3] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">Properties</p>
            <p className="mt-1 text-base font-extrabold tracking-[-0.01em]">
              {selected
                ? OBJECT_NAMES[selected.kind] ?? 'Object'
                : activeBlock
                  ? activeBlock.block.cell ? 'Table cell' : 'Document text'
                  : 'Document'}
            </p>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {activeBlock && (
              <>
                <label className="block">
                  <Label>{activeBlock.block.cell ? 'Cell text' : 'Text'}</Label>
                  <textarea
                    value={activeBlock.text}
                    onChange={(e) => patchBlock(activeBlock.block.id, { text: e.target.value }, false)}
                    onFocus={() => setEditingBlockId(null)}
                    rows={5}
                    className={`${fieldClass} resize-y leading-relaxed`}
                  />
                </label>

                {(() => {
                  const missing = unsupportedGlyphs(activeBlock.text);
                  if (missing.length === 0) return null;
                  return (
                    <div className="flex items-start gap-2 border-l-[3px] border-[#ec3013] bg-[#fff2ef] px-3 py-2.5">
                      <span className="mt-px flex-none text-[#ae1800]"><Icon d="M12 8h.01M11 12h1v4h1" size={14} width={2} /></span>
                      <span className="text-[11px] leading-snug text-[#7c1405]">
                        The standard PDF fonts cannot draw{' '}
                        <b>{missing.slice(0, 6).join(' ')}{missing.length > 6 ? '…' : ''}</b>. Deleting this text works
                        fine, but anything you retype loses those characters.
                      </span>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-[1fr_74px] gap-2.5">
                  <label className="block">
                    <Label>Font</Label>
                    <select
                      value={activeBlock.font}
                      onChange={(e) => patchBlock(activeBlock.block.id, { font: e.target.value as AnnotationFontKey })}
                      className={fieldClass}
                    >
                      {FONT_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <Label>Size</Label>
                    <input
                      type="number" min={4} max={200} step={0.5}
                      value={activeBlock.size}
                      onChange={(e) => patchBlock(activeBlock.block.id, { size: Number(e.target.value) || activeBlock.size })}
                      className={fieldClass}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => patchBlock(activeBlock.block.id, { font: restyleFont(activeBlock.font, { bold: !isBoldFont(activeBlock.font) }) })}
                    className={`flex-1 border-2 py-2 text-sm font-extrabold ${isBoldFont(activeBlock.font) ? 'border-[#201e1d] bg-[#201e1d] text-[#f3f2f2]' : 'border-[#bab6b6]'}`}
                  >
                    B
                  </button>
                  <button
                    onClick={() => patchBlock(activeBlock.block.id, { font: restyleFont(activeBlock.font, { italic: !isItalicFont(activeBlock.font) }) })}
                    className={`flex-1 border-2 py-2 text-sm italic ${isItalicFont(activeBlock.font) ? 'border-[#201e1d] bg-[#201e1d] text-[#f3f2f2]' : 'border-[#bab6b6]'}`}
                  >
                    I
                  </button>
                  <label className="flex-[2]">
                    <input
                      type="number" min={1} step={0.5}
                      value={activeBlock.lineHeight}
                      onChange={(e) => patchBlock(activeBlock.block.id, { lineHeight: Number(e.target.value) || activeBlock.lineHeight })}
                      title="Line height in points"
                      className={`${fieldClass} py-2`}
                    />
                  </label>
                </div>

                <div>
                  <Label>Alignment</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALIGNMENTS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => patchBlock(activeBlock.block.id, { align: option.value })}
                        className={`border-2 py-1.5 text-[10px] font-bold ${activeBlock.align === option.value ? 'border-[#ec3013] bg-[#fff2ef] text-[#ae1800]' : 'border-[#d7d3d3]'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Text colour</Label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => patchBlock(activeBlock.block.id, { color: swatch })}
                        title={swatch}
                        className={`h-7 w-7 border-2 ${activeBlock.color.toLowerCase() === swatch ? 'border-[#201e1d]' : 'border-[#d7d3d3]'}`}
                        style={{ background: swatch }}
                      />
                    ))}
                    <input
                      type="color"
                      value={activeBlock.color}
                      onChange={(e) => patchBlock(activeBlock.block.id, { color: e.target.value })}
                      className="h-7 w-7 cursor-pointer border-2 border-[#d7d3d3] bg-white p-0"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3">
                  <span>
                    <Label>Paper colour</Label>
                    <span className="block text-[11px] leading-snug text-[#7d7979]">
                      Painted over the original words. Nudge it if the patch shows.
                    </span>
                  </span>
                  <input
                    type="color"
                    value={activeBlock.background}
                    onChange={(e) => patchBlock(activeBlock.block.id, { background: e.target.value })}
                    className="h-9 w-9 flex-none cursor-pointer border-2 border-[#d7d3d3] bg-white p-0"
                  />
                </label>

                <label className="flex items-start gap-2.5 border border-[#d7d3d3] bg-white px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={reflow}
                    onChange={(e) => setReflow(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-[#ec3013]"
                  />
                  <span>
                    <span className="block text-xs font-bold">Reflow the column</span>
                    <span className="block text-[11px] leading-snug text-[#7d7979]">
                      Paragraphs and table rows below move as this one grows or shrinks.
                    </span>
                  </span>
                </label>

                <div className="border-t border-[#d7d3d3] pt-3">
                  {[
                    ['Measure', `${Math.round(activeBlock.block.width)} pt`],
                    ['Lines', `${activeBlock.lines.length} of ${activeBlock.block.naturalLines} originally`],
                    ['Shifted', `${activeBlock.shift === 0 ? 'no' : `${Math.abs(Math.round(activeBlock.shift))} pt ${activeBlock.shift < 0 ? 'down' : 'up'}`}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[#eae7e7] py-1.5 text-xs">
                      <span className="text-[#7d7979]">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => patchBlock(activeBlock.block.id, { removed: !activeBlock.removed })}
                    className="flex-1 border-2 border-[#ec3013] px-3 py-2.5 text-left text-xs font-bold text-[#ae1800] hover:bg-[#fff2ef]"
                  >
                    {activeBlock.removed ? 'Put text back' : 'Erase text'}
                  </button>
                  <button
                    onClick={() => resetBlock(activeBlock.block.id)}
                    disabled={!activeBlock.changed}
                    className="flex-1 border-2 border-[#201e1d] px-3 py-2.5 text-left text-xs font-bold hover:bg-[#eae7e7] disabled:opacity-35"
                  >
                    Restore original
                  </button>
                </div>
              </>
            )}

            {selected?.kind === 'text' && (
              <>
                <label className="block">
                  <Label>Content</Label>
                  <textarea
                    ref={textAreaRef}
                    value={selected.text}
                    onChange={(e) => patch(selected.id, { text: e.target.value } as Partial<Annotation>)}
                    rows={4}
                    className={`${fieldClass} resize-y leading-relaxed`}
                  />
                </label>
                <div className="grid grid-cols-[1fr_84px] gap-2.5">
                  <label className="block">
                    <Label>Font</Label>
                    <select
                      value={selected.font}
                      onChange={(e) => { const v = e.target.value as AnnotationFontKey; setFont(v); patch(selected.id, { font: v } as Partial<Annotation>); }}
                      className={fieldClass}
                    >
                      {FONT_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <Label>Size</Label>
                    <input
                      type="number" min={4} max={200}
                      value={selected.size}
                      onChange={(e) => { const v = Number(e.target.value) || 12; setFontSize(v); patch(selected.id, { size: v } as Partial<Annotation>); }}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <div className="flex items-start gap-2 border-l-[3px] border-[#ec3013] bg-[#fff2ef] px-3 py-2.5">
                  <span className="mt-px flex-none text-[#ae1800]"><Icon d="M12 8h.01M11 12h1v4h1" size={14} width={2} /></span>
                  <span className="text-[11px] leading-snug text-[#7c1405]">
                    Standard PDF fonts only — accents outside WinAnsi are transliterated on export.
                  </span>
                </div>
              </>
            )}

            {selected?.kind === 'image' && (
              <>
                <div className="border border-[#bab6b6] bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.dataUrl} alt="Selected" className="mx-auto max-h-28 w-auto" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <Label>Width %</Label>
                    <input
                      type="number" min={1} max={100}
                      value={Math.round(selected.width * 100)}
                      onChange={(e) => patch(selected.id, { width: clamp01(Number(e.target.value) / 100) } as Partial<Annotation>)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <Label>Height %</Label>
                    <input
                      type="number" min={1} max={100}
                      value={Math.round(selected.height * 100)}
                      onChange={(e) => patch(selected.id, { height: clamp01(Number(e.target.value) / 100) } as Partial<Annotation>)}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="bg-[#ec3013] px-3 py-2.5 text-left text-xs font-bold text-white hover:bg-[#ae1800]"
                >
                  Place another image
                </button>
              </>
            )}

            {selected && selected.kind !== 'text' && selected.kind !== 'image' && (
              <label className="block">
                <Label>Stroke width — {'strokeWidth' in selected ? selected.strokeWidth : strokeWidth}pt</Label>
                <input
                  type="range" min={0.5} max={16} step={0.5}
                  value={'strokeWidth' in selected ? selected.strokeWidth : strokeWidth}
                  onChange={(e) => { const v = Number(e.target.value); setStrokeWidth(v); patch(selected.id, { strokeWidth: v } as Partial<Annotation>); }}
                  className="w-full accent-[#ec3013] bg-[#d7d3d3]"
                />
              </label>
            )}

            {selected && (
              <>
                <div>
                  <Label>Colour</Label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => {
                          setColor(swatch);
                          patch(selected.id, (selected.kind === 'text' ? { color: swatch } : { strokeColor: swatch, ...(selected.kind === 'highlight' ? { fillColor: swatch } : {}) }) as Partial<Annotation>);
                        }}
                        title={swatch}
                        className={`h-7 w-7 border-2 ${color === swatch ? 'border-[#201e1d]' : 'border-[#d7d3d3]'}`}
                        style={{ background: swatch }}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        patch(selected.id, (selected.kind === 'text' ? { color: e.target.value } : { strokeColor: e.target.value }) as Partial<Annotation>);
                      }}
                      className="h-7 w-7 cursor-pointer border-2 border-[#d7d3d3] bg-white p-0"
                    />
                  </div>
                </div>

                <label className="block">
                  <Label>Opacity — {Math.round(selected.opacity * 100)}%</Label>
                  <input
                    type="range" min={5} max={100}
                    value={Math.round(selected.opacity * 100)}
                    onChange={(e) => { const v = Number(e.target.value) / 100; setOpacity(v); patch(selected.id, { opacity: v } as Partial<Annotation>); }}
                    className="w-full accent-[#ec3013] bg-[#d7d3d3]"
                  />
                </label>

                {(selected.kind === 'rect' || selected.kind === 'ellipse') && (
                  <button
                    onClick={() => {
                      const value = selected.fillColor ? null : color;
                      setFillColor(value);
                      patch(selected.id, { fillColor: value } as Partial<Annotation>);
                    }}
                    className="border-2 border-[#201e1d] px-3 py-2 text-left text-xs font-bold hover:bg-[#eae7e7]"
                  >
                    {selected.fillColor ? 'Remove fill' : 'Add fill'}
                  </button>
                )}

                <div className="flex gap-2 border-t border-[#d7d3d3] pt-3.5">
                  <button onClick={duplicateSelected} className="flex-1 border-2 border-[#201e1d] px-3 py-2.5 text-left text-xs font-bold hover:bg-[#eae7e7]">
                    Duplicate
                  </button>
                  <button onClick={removeSelected} className="flex-1 border-2 border-[#ec3013] px-3 py-2.5 text-left text-xs font-bold text-[#ae1800] hover:bg-[#fff2ef]">
                    Delete
                  </button>
                </div>
              </>
            )}

            {!selected && !activeBlock && (
              <>
                <p className="text-[13px] leading-relaxed text-[#605d5d]">
                  Nothing selected. Pick a tool on the left and click or drag on the page — or click an object you already
                  added to change it here.
                </p>
                <div className="border-t border-[#d7d3d3] pt-3.5">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d7979]">Document</p>
                  {[
                    ['Pages', `${pageOrder.length}${pageOrder.length !== geometry.length ? ` of ${geometry.length}` : ''}`],
                    ['Objects on page', String(pageAnnotations.length)],
                    ['Editable text regions', String(liveBlocks.length)],
                    ['Rewritten text', String(rewrites)],
                    ['Total edits', String(editCount)],
                    ['Undo steps', String(history.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[#eae7e7] py-1.5 text-xs">
                      <span className="text-[#7d7979]">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
                {editCount > 0 && (
                  <button
                    onClick={() => {
                      pushHistory();
                      setAnnotations([]);
                      setBlockEdits({});
                      setSelectedId(null);
                      setActiveBlockId(null);
                      setEditingBlockId(null);
                    }}
                    className="border-2 border-[#201e1d] px-3 py-2.5 text-left text-xs font-bold hover:bg-[#eae7e7]"
                  >
                    Clear all edits
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile text-block sheet */}
      {activeBlock && !selected && (
        <div className="flex-none border-t-2 border-[#201e1d] p-3 xl:hidden">
          <div className="mb-2 flex items-center gap-2">
            <span className="bg-[#ec3013] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
              {activeBlock.block.cell ? 'cell' : 'text'}
            </span>
            <span className="text-[11px] text-[#7d7979]">{activeBlock.size}pt · {activeBlock.align}</span>
            <button onClick={() => { setActiveBlockId(null); setEditingBlockId(null); }} className="ml-auto text-xs font-bold text-[#605d5d]">Done</button>
          </div>
          <textarea
            value={activeBlock.text}
            onChange={(e) => patchBlock(activeBlock.block.id, { text: e.target.value }, false)}
            rows={2}
            className={`${fieldClass} resize-none`}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => patchBlock(activeBlock.block.id, { size: Math.max(4, activeBlock.size - 1) })}
              className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold"
            >
              A−
            </button>
            <button
              onClick={() => patchBlock(activeBlock.block.id, { size: activeBlock.size + 1 })}
              className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold"
            >
              A+
            </button>
            <button
              onClick={() => patchBlock(activeBlock.block.id, { removed: !activeBlock.removed })}
              className="min-h-11 flex-1 border-2 border-[#ec3013] text-sm font-bold text-[#ae1800]"
            >
              {activeBlock.removed ? 'Undo' : 'Erase'}
            </button>
            <button
              onClick={() => resetBlock(activeBlock.block.id)}
              disabled={!activeBlock.changed}
              className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold disabled:opacity-35"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Mobile selection sheet */}
      {selected && (
        <div className="flex-none border-t-2 border-[#201e1d] p-3 xl:hidden">
          <div className="mb-2 flex items-center gap-2">
            <span className="bg-[#ec3013] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">{selected.kind}</span>
            <button onClick={() => setSelectedId(null)} className="ml-auto text-xs font-bold text-[#605d5d]">Done</button>
          </div>
          {selected.kind === 'text' && (
            <textarea
              value={selected.text}
              onChange={(e) => patch(selected.id, { text: e.target.value } as Partial<Annotation>)}
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          )}
          <div className="mt-2 flex gap-2">
            {selected.kind === 'text' && (
              <>
                <button onClick={() => patch(selected.id, { size: Math.max(4, selected.size - 2) } as Partial<Annotation>)} className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold">A−</button>
                <button onClick={() => patch(selected.id, { size: selected.size + 2 } as Partial<Annotation>)} className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold">A+</button>
              </>
            )}
            <button onClick={duplicateSelected} className="min-h-11 flex-1 border-2 border-[#201e1d] text-sm font-bold">Copy</button>
            <button onClick={removeSelected} className="min-h-11 flex-1 border-2 border-[#ec3013] text-sm font-bold text-[#ae1800]">Delete</button>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { pickImage(e.target.files); e.target.value = ''; }}
      />

      {error && (
        <div className="flex-none border-t-2 border-[#ec3013] bg-[#fff2ef] px-4 py-2.5 text-sm font-semibold text-[#7c1405]">
          {error}
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(32,30,29,0.55)] p-6" onClick={() => !busy && setShowExport(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[520px] max-w-full border-2 border-[#201e1d] bg-[#f3f2f2] shadow-[0_12px_32px_rgba(45,43,43,0.22)]"
          >
            <div className="border-b-2 border-[#201e1d] px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ec3013]">Export</p>
              <p className="mt-1.5 text-[26px] font-extrabold tracking-[-0.01em]">Save your edits</p>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <label className="block">
                <Label>File name</Label>
                <input value={exportName} onChange={(e) => setExportName(e.target.value)} className={`${fieldClass} py-2.5 text-sm`} />
              </label>

              <div>
                <Label>How to write the file</Label>
                <button
                  onClick={() => setExportMode('editable')}
                  className={`block w-full border-2 px-3.5 py-3 text-left ${exportMode === 'editable' ? 'border-[#ec3013] bg-white' : 'border-[#d7d3d3]'}`}
                >
                  <span className="block text-[13px] font-extrabold">Keep text editable</span>
                  <span className="mt-0.5 block text-xs text-[#605d5d]">Your text and shapes stay as real PDF objects.</span>
                </button>
                <button
                  onClick={() => setExportMode('flat')}
                  className={`mt-2 block w-full border-2 px-3.5 py-3 text-left ${exportMode === 'flat' ? 'border-[#ec3013] bg-white' : 'border-[#d7d3d3]'}`}
                >
                  <span className="block text-[13px] font-extrabold">Flatten everything</span>
                  <span className="mt-0.5 block text-xs text-[#605d5d]">Every page rasterised — edits burned in, nothing selectable.</span>
                </button>
              </div>

              <div className="flex justify-between border-t border-[#d7d3d3] pt-3 text-xs">
                <span className="text-[#7d7979]">{pageOrder.length} pages · {editCount} edits{rewrites > 0 ? ` · ${rewrites} rewritten` : ''}</span>
                <span className="font-bold">{exportMode === 'flat' ? 'Rasterised output' : 'Vector output'}</span>
              </div>

              {busy && (
                <div className="h-1.5 w-full bg-[#d7d3d3]">
                  <div className="h-full bg-[#ec3013] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 px-6 pb-5">
              <button
                onClick={() => setShowExport(false)}
                disabled={busy}
                className="border-2 border-[#201e1d] px-4 py-3 text-[13px] font-bold hover:bg-[#eae7e7] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={runExport}
                disabled={busy}
                className="flex-1 bg-[#ec3013] px-4 py-3 text-left text-[13px] font-bold text-white hover:bg-[#ae1800] disabled:opacity-60"
              >
                {busy ? `Writing PDF… ${progress}%` : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
