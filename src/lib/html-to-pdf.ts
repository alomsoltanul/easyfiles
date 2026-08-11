import { PDFDocument } from '@cantoo/pdf-lib';
import { toBlob } from './pdf-common';
import type { ProgressFn, ToolOutput } from './pdf-common';
import { preparePage } from './html-prepare';

export type HtmlPageSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'Fit';

export interface HtmlToPdfOptions {
  pageSize: HtmlPageSize;
  orientation: 'portrait' | 'landscape';
  /** Millimetres. */
  margin: number;
  /** CSS pixel width the page is laid out at, i.e. the emulated viewport. */
  viewportWidth: number;
  /** Device pixel ratio for the capture — higher is sharper and heavier. */
  scale: number;
  background: string;
  /** Avoid slicing through a line of text when a page break lands on one. */
  smartPageBreaks: boolean;
  /** Extra settle time in ms for fonts, images and lazy content. */
  settleMs: number;
}

export const DEFAULT_HTML_OPTIONS: HtmlToPdfOptions = {
  pageSize: 'A4',
  orientation: 'portrait',
  margin: 10,
  viewportWidth: 1280,
  scale: 2,
  background: '#ffffff',
  smartPageBreaks: true,
  settleMs: 700,
};

const PAGE_POINTS: Record<Exclude<HtmlPageSize, 'Fit'>, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
};

const MM_TO_PT = 72 / 25.4;

export interface FetchedPage {
  html: string;
  title: string;
  finalUrl: string;
  assets: number;
  bytes: number;
}

export async function fetchPageHtml(url: string): Promise<FetchedPage> {
  const response = await fetch('/api/html/fetch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? 'That page could not be loaded.');
  }
  return payload as FetchedPage;
}

/** Prepare hand-written or uploaded HTML the same way a fetched page is prepared. */
export function prepareLocalHtml(html: string, baseUrl?: string): string {
  const base = baseUrl && /^https?:\/\//i.test(baseUrl) ? baseUrl : 'https://localhost/';
  return preparePage(html, base).html;
}

interface Frame {
  iframe: HTMLIFrameElement;
  doc: Document;
  cleanup: () => void;
}

async function mountFrame(html: string, width: number, settleMs: number): Promise<Frame> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${width}px`,
    'height:1200px',
    'border:0',
    'visibility:hidden',
  ].join(';');

  document.body.appendChild(iframe);
  const cleanup = () => { iframe.remove(); };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    throw new Error('Your browser blocked the offscreen renderer.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    if (doc.readyState === 'complete') { resolve(); return; }
    const done = () => resolve();
    iframe.addEventListener('load', done, { once: true });
    setTimeout(done, 8000);
  });

  // Wait for fonts and images so nothing renders as a blank box.
  try {
    await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    // Font loading API is best-effort.
  }

  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) { resolve(); return; }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 6000);
        })
    )
  );

  if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));

  // Grow the frame to the full document height so nothing is clipped.
  const height = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight ?? 0,
    600
  );
  iframe.style.height = `${height}px`;
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  return { iframe, doc, cleanup };
}

/**
 * Look for a horizontal band of uniform pixels near the intended cut so a page
 * break lands between lines instead of slicing through one.
 */
function findCutRow(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  idealRow: number,
  searchUp: number
): number {
  const start = Math.max(1, idealRow - searchUp);
  const sampleWidth = Math.min(canvasWidth, 1400);
  const step = Math.max(1, Math.floor(sampleWidth / 220));

  for (let row = idealRow; row >= start; row--) {
    const line = ctx.getImageData(0, row, sampleWidth, 1).data;
    let uniform = true;
    const r0 = line[0];
    const g0 = line[1];
    const b0 = line[2];
    for (let x = step * 4; x < line.length; x += step * 4) {
      if (Math.abs(line[x] - r0) > 6 || Math.abs(line[x + 1] - g0) > 6 || Math.abs(line[x + 2] - b0) > 6) {
        uniform = false;
        break;
      }
    }
    if (uniform) return row;
  }
  return idealRow;
}

export async function htmlToPDF(
  html: string,
  options: HtmlToPdfOptions,
  fileName: string,
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  const html2canvas = (await import('html2canvas-pro')).default;
  onProgress?.(8);

  const frame = await mountFrame(html, options.viewportWidth, options.settleMs);
  onProgress?.(30);

  let capture: HTMLCanvasElement;
  try {
    const target = frame.doc.documentElement;
    capture = await html2canvas(target, {
      backgroundColor: options.background,
      scale: Math.max(1, Math.min(3, options.scale)),
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: options.viewportWidth,
      windowWidth: options.viewportWidth,
      height: Math.max(target.scrollHeight, frame.doc.body?.scrollHeight ?? 0),
      windowHeight: Math.max(target.scrollHeight, frame.doc.body?.scrollHeight ?? 0),
    });
  } finally {
    frame.cleanup();
  }

  onProgress?.(65);

  if (capture.width === 0 || capture.height === 0) {
    throw new Error('The page rendered empty — it may require JavaScript to show its content.');
  }

  const doc = await PDFDocument.create();
  const marginPt = Math.max(0, options.margin) * MM_TO_PT;

  if (options.pageSize === 'Fit') {
    // One tall page that matches the capture exactly.
    const widthPt = capture.width / options.scale * 0.75; // CSS px → pt
    const heightPt = capture.height / options.scale * 0.75;
    const image = await doc.embedJpg(capture.toDataURL('image/jpeg', 0.92));
    const page = doc.addPage([widthPt + marginPt * 2, heightPt + marginPt * 2]);
    page.drawImage(image, { x: marginPt, y: marginPt, width: widthPt, height: heightPt });
    const bytes = await doc.save();
    onProgress?.(100);
    return { blob: toBlob(bytes), name: fileName };
  }

  const [basePw, basePh] = PAGE_POINTS[options.pageSize];
  const [pageW, pageH] = options.orientation === 'landscape' ? [basePh, basePw] : [basePw, basePh];
  const contentW = pageW - marginPt * 2;
  const contentH = pageH - marginPt * 2;
  if (contentW <= 20 || contentH <= 20) throw new Error('Those margins leave no room for content.');

  // Scale so the capture width fills the printable width.
  const pxPerPt = capture.width / contentW;
  const sliceHeightPx = Math.floor(contentH * pxPerPt);

  const source = capture.getContext('2d', { willReadFrequently: true });
  if (!source) throw new Error('Your browser blocked canvas rendering.');

  const slice = document.createElement('canvas');
  const sliceCtx = slice.getContext('2d');
  if (!sliceCtx) throw new Error('Your browser blocked canvas rendering.');

  let offset = 0;
  let pageIndex = 0;
  const estimatedPages = Math.max(1, Math.ceil(capture.height / sliceHeightPx));

  while (offset < capture.height) {
    let take = Math.min(sliceHeightPx, capture.height - offset);

    if (options.smartPageBreaks && offset + take < capture.height) {
      const searchWindow = Math.floor(sliceHeightPx * 0.12);
      const cut = findCutRow(source, capture.width, offset + take, searchWindow);
      // Only accept the adjusted break if it still fills most of the page.
      if (cut - offset > sliceHeightPx * 0.6) take = cut - offset;
    }

    slice.width = capture.width;
    slice.height = take;
    sliceCtx.fillStyle = options.background;
    sliceCtx.fillRect(0, 0, slice.width, slice.height);
    sliceCtx.drawImage(capture, 0, offset, capture.width, take, 0, 0, capture.width, take);

    const image = await doc.embedJpg(slice.toDataURL('image/jpeg', 0.9));
    const drawH = take / pxPerPt;
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(image, {
      x: marginPt,
      y: pageH - marginPt - drawH,
      width: contentW,
      height: drawH,
    });

    offset += take;
    pageIndex++;
    onProgress?.(65 + Math.min(30, Math.round((pageIndex / estimatedPages) * 30)));
    if (pageIndex > 400) break; // runaway guard
  }

  const bytes = await doc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: fileName };
}
