import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { toBlob } from './pdf-common';
import type { ProgressFn, ToolOutput } from './pdf-common';

export type DiffOp = { type: 'equal' | 'insert' | 'delete'; text: string };

export interface PageComparison {
  /** 0-based page index in the aligned view. */
  index: number;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  /** 0..1 — share of pixels that differ. */
  pixelDelta: number;
  /** 0..1 — share of words that are identical. */
  textSimilarity: number;
  ops: DiffOp[];
  leftImage: string | null;
  rightImage: string | null;
  diffImage: string | null;
}

export interface CompareOptions {
  /** Render scale for the visual diff. */
  scale: number;
  /** 0-255 per-channel tolerance before a pixel counts as different. */
  pixelTolerance: number;
  /** Skip the raster pass and compare text only (much faster). */
  textOnly: boolean;
  /** Ignore whitespace-only differences in the word diff. */
  ignoreWhitespace: boolean;
  /** Guard rail for very long documents. */
  maxPages: number;
}

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  scale: 1.2,
  pixelTolerance: 28,
  textOnly: false,
  ignoreWhitespace: true,
  maxPages: 60,
};

export interface CompareResult {
  pages: PageComparison[];
  leftPages: number;
  rightPages: number;
  changed: number;
  added: number;
  removed: number;
  truncated: boolean;
  leftName: string;
  rightName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
async function getPDFJS() {
  if (!pdfjsLib) {
    const mod = await import('pdfjs-dist');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mod as any).GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfjsLib = mod;
  }
  return pdfjsLib;
}

// ---------- word diff ----------

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/**
 * Word-level diff. Identical prefixes and suffixes are stripped first, then the
 * remainder goes through an LCS table. Documents too large for the table fall
 * back to a single replace op so the tool still reports the page as changed.
 */
export function diffWords(a: string, b: string, ignoreWhitespace: boolean): DiffOp[] {
  let left = tokenize(a);
  let right = tokenize(b);

  if (ignoreWhitespace) {
    left = left.filter((t) => t.trim().length > 0);
    right = right.filter((t) => t.trim().length > 0);
  }

  const ops: DiffOp[] = [];
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start++;

  let endA = left.length;
  let endB = right.length;
  while (endA > start && endB > start && left[endA - 1] === right[endB - 1]) { endA--; endB--; }

  const push = (type: DiffOp['type'], tokens: string[]) => {
    if (tokens.length === 0) return;
    const text = tokens.join(' ');
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += ` ${text}`;
    else ops.push({ type, text });
  };

  push('equal', left.slice(0, start));

  const midA = left.slice(start, endA);
  const midB = right.slice(start, endB);

  if (midA.length === 0 || midB.length === 0) {
    push('delete', midA);
    push('insert', midB);
  } else if (midA.length * midB.length > 4_000_000) {
    push('delete', midA);
    push('insert', midB);
  } else {
    const n = midA.length;
    const m = midB.length;
    // Rolling LCS lengths, then a backtrack over a compact table.
    const table: Uint32Array = new Uint32Array((n + 1) * (m + 1));
    const at = (i: number, j: number) => i * (m + 1) + j;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[at(i, j)] = midA[i] === midB[j]
          ? table[at(i + 1, j + 1)] + 1
          : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
      }
    }
    let i = 0;
    let j = 0;
    let runEqual: string[] = [];
    let runDel: string[] = [];
    let runIns: string[] = [];
    const flush = () => {
      push('delete', runDel); runDel = [];
      push('insert', runIns); runIns = [];
      push('equal', runEqual); runEqual = [];
    };
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        if (runDel.length || runIns.length) { push('delete', runDel); runDel = []; push('insert', runIns); runIns = []; }
        runEqual.push(midA[i]); i++; j++;
      } else {
        if (runEqual.length) { push('equal', runEqual); runEqual = []; }
        if (table[at(i + 1, j)] >= table[at(i, j + 1)]) { runDel.push(midA[i]); i++; }
        else { runIns.push(midB[j]); j++; }
      }
    }
    flush();
    push('delete', midA.slice(i));
    push('insert', midB.slice(j));
  }

  push('equal', left.slice(endA));
  return ops;
}

function similarity(ops: DiffOp[]): number {
  let same = 0;
  let total = 0;
  for (const op of ops) {
    const n = op.text.length;
    total += n;
    if (op.type === 'equal') same += n;
  }
  return total === 0 ? 1 : same / total;
}

// ---------- rendering ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderToCanvas(pdf: any, pageNum: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser blocked canvas rendering');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageText(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return content.items.map((i: any) => i.str ?? '').join(' ').replace(/\s+/g, ' ').trim();
}

function padTo(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  if (canvas.width === width && canvas.height === height) return canvas;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/** Grey base + magenta wash over every pixel that moved. */
function buildDiffCanvas(
  left: HTMLCanvasElement,
  right: HTMLCanvasElement,
  tolerance: number
): { canvas: HTMLCanvasElement; ratio: number } {
  const width = Math.max(left.width, right.width);
  const height = Math.max(left.height, right.height);
  const a = padTo(left, width, height).getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height);
  const b = padTo(right, width, height).getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  const image = ctx.createImageData(width, height);

  let changed = 0;
  const total = width * height;

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const dr = Math.abs(a.data[p] - b.data[p]);
    const dg = Math.abs(a.data[p + 1] - b.data[p + 1]);
    const db = Math.abs(a.data[p + 2] - b.data[p + 2]);
    const different = dr > tolerance || dg > tolerance || db > tolerance;

    if (different) {
      changed++;
      const onlyInLeft = a.data[p] + a.data[p + 1] + a.data[p + 2] < b.data[p] + b.data[p + 1] + b.data[p + 2];
      // Red = present in the original only, green = present in the revision only.
      image.data[p] = onlyInLeft ? 220 : 22;
      image.data[p + 1] = onlyInLeft ? 38 : 163;
      image.data[p + 2] = onlyInLeft ? 38 : 74;
      image.data[p + 3] = 255;
    } else {
      const grey = 255 - (255 - (b.data[p] * 0.299 + b.data[p + 1] * 0.587 + b.data[p + 2] * 0.114)) * 0.25;
      image.data[p] = grey;
      image.data[p + 1] = grey;
      image.data[p + 2] = grey;
      image.data[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return { canvas: out, ratio: total === 0 ? 0 : changed / total };
}

export async function comparePDFs(
  fileA: File,
  fileB: File,
  options: CompareOptions,
  onProgress?: ProgressFn
): Promise<CompareResult> {
  const pdfjs = await getPDFJS();
  const [bytesA, bytesB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
  const [pdfA, pdfB] = await Promise.all([
    pdfjs.getDocument({ data: bytesA }).promise,
    pdfjs.getDocument({ data: bytesB }).promise,
  ]);

  const leftPages: number = pdfA.numPages;
  const rightPages: number = pdfB.numPages;
  const span = Math.max(leftPages, rightPages);
  const limit = Math.min(span, options.maxPages);

  const pages: PageComparison[] = [];
  let changed = 0;
  let added = 0;
  let removed = 0;

  for (let i = 0; i < limit; i++) {
    const hasLeft = i < leftPages;
    const hasRight = i < rightPages;

    const textA = hasLeft ? await pageText(pdfA, i + 1) : '';
    const textB = hasRight ? await pageText(pdfB, i + 1) : '';
    const ops = diffWords(textA, textB, options.ignoreWhitespace);

    let leftImage: string | null = null;
    let rightImage: string | null = null;
    let diffImage: string | null = null;
    let pixelDelta = 0;

    if (!options.textOnly) {
      const canvasA = hasLeft ? await renderToCanvas(pdfA, i + 1, options.scale) : null;
      const canvasB = hasRight ? await renderToCanvas(pdfB, i + 1, options.scale) : null;
      leftImage = canvasA ? canvasA.toDataURL('image/png') : null;
      rightImage = canvasB ? canvasB.toDataURL('image/png') : null;
      if (canvasA && canvasB) {
        const diff = buildDiffCanvas(canvasA, canvasB, options.pixelTolerance);
        diffImage = diff.canvas.toDataURL('image/png');
        pixelDelta = diff.ratio;
      } else {
        pixelDelta = 1;
      }
    } else if (!hasLeft || !hasRight) {
      pixelDelta = 1;
    } else {
      pixelDelta = ops.some((o) => o.type !== 'equal') ? 1 : 0;
    }

    let status: PageComparison['status'];
    if (!hasLeft) { status = 'added'; added++; }
    else if (!hasRight) { status = 'removed'; removed++; }
    else if (ops.some((o) => o.type !== 'equal') || pixelDelta > 0.001) { status = 'changed'; changed++; }
    else status = 'unchanged';

    pages.push({
      index: i,
      status,
      pixelDelta,
      textSimilarity: similarity(ops),
      ops,
      leftImage,
      rightImage,
      diffImage,
    });

    onProgress?.(Math.round(((i + 1) / limit) * 100));
  }

  return {
    pages,
    leftPages,
    rightPages,
    changed,
    added,
    removed,
    truncated: span > limit,
    leftName: fileA.name,
    rightName: fileB.name,
  };
}

/**
 * Build a shareable PDF report: a summary sheet followed by one landscape sheet
 * per differing page holding the original, the revision, and the diff overlay.
 */
export async function buildComparisonReport(result: CompareResult): Promise<ToolOutput> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const summary = doc.addPage([595.28, 841.89]);
  const { width: sw, height: sh } = summary.getSize();
  let y = sh - 64;

  summary.drawText('PDF Comparison Report', { x: 48, y, size: 22, font: bold, color: rgb(0.06, 0.09, 0.16) });
  y -= 30;
  const meta = [
    `Original: ${result.leftName} (${result.leftPages} pages)`,
    `Revision: ${result.rightName} (${result.rightPages} pages)`,
    `Changed pages: ${result.changed}   Added: ${result.added}   Removed: ${result.removed}`,
    `Generated: ${new Date().toLocaleString()}`,
  ];
  for (const line of meta) {
    summary.drawText(line.slice(0, 110), { x: 48, y, size: 10, font, color: rgb(0.3, 0.35, 0.45) });
    y -= 16;
  }

  y -= 12;
  summary.drawText('Page summary', { x: 48, y, size: 13, font: bold, color: rgb(0.06, 0.09, 0.16) });
  y -= 20;

  for (const page of result.pages) {
    if (y < 60) break;
    const colour =
      page.status === 'unchanged' ? rgb(0.4, 0.45, 0.53)
      : page.status === 'added' ? rgb(0.09, 0.55, 0.31)
      : page.status === 'removed' ? rgb(0.75, 0.15, 0.15)
      : rgb(0.79, 0.45, 0.05);
    summary.drawText(
      `Page ${page.index + 1} — ${page.status} · text match ${(page.textSimilarity * 100).toFixed(1)}% · pixels changed ${(page.pixelDelta * 100).toFixed(2)}%`,
      { x: 48, y, size: 9.5, font, color: colour }
    );
    y -= 14;
  }

  summary.drawText('Generated with ConvertTools — processed entirely in your browser', {
    x: 48, y: 36, size: 8, font, color: rgb(0.6, 0.64, 0.7),
  });
  void sw;

  for (const page of result.pages) {
    if (page.status === 'unchanged') continue;
    if (!page.leftImage && !page.rightImage) continue;

    const sheet = doc.addPage([841.89, 595.28]);
    const { width, height } = sheet.getSize();
    sheet.drawText(`Page ${page.index + 1} — ${page.status}`, {
      x: 32, y: height - 34, size: 13, font: bold, color: rgb(0.06, 0.09, 0.16),
    });

    const labels = ['Original', 'Revision', 'Differences'];
    const sources = [page.leftImage, page.rightImage, page.diffImage];
    const slot = (width - 64 - 24) / 3;
    const top = height - 56;
    const available = top - 40;

    for (let i = 0; i < 3; i++) {
      const x = 32 + i * (slot + 12);
      sheet.drawText(labels[i], { x, y: top + 6, size: 9, font, color: rgb(0.4, 0.45, 0.53) });
      const src = sources[i];
      if (!src) {
        sheet.drawText('—', { x, y: top - 20, size: 12, font, color: rgb(0.7, 0.72, 0.76) });
        continue;
      }
      const image = await doc.embedPng(src);
      const scale = Math.min(slot / image.width, available / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      sheet.drawImage(image, { x, y: top - h, width: w, height: h });
      sheet.drawRectangle({
        x, y: top - h, width: w, height: h,
        borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 0.75,
      });
    }
  }

  const bytes = await doc.save();
  const base = result.leftName.replace(/\.[^.]+$/, '');
  return { blob: toBlob(bytes), name: `${base}-comparison.pdf` };
}
