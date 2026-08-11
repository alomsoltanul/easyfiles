import { PDFDocument } from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName } from './pdf-common';
import type { NormRect, ProgressFn, ToolOutput } from './pdf-common';

export interface Redaction {
  id: string;
  /** 0-based page index */
  page: number;
  /** Normalised to the rendered page, y from the top. */
  rect: NormRect;
  /** Set when the box came from a text search rather than the mouse. */
  label?: string;
}

export interface RedactOptions {
  /** Raster resolution for redacted pages. */
  dpi: number;
  /** Fill colour of the redaction boxes. */
  color: string;
  /** Wipe title, author, subject and keywords from the output. */
  stripMetadata: boolean;
}

export const DEFAULT_REDACT_OPTIONS: RedactOptions = {
  dpi: 200,
  color: '#000000',
  stripMetadata: true,
};

export interface TextMatch {
  page: number;
  rect: NormRect;
  text: string;
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

/**
 * Locate every occurrence of `query` and return its box in rendered-page
 * coordinates. Matches are found inside a single text run — pdf.js splits runs
 * on style changes, so a phrase broken across runs is reported per fragment.
 */
export async function findTextMatches(
  file: File,
  query: string,
  opts: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean } = {}
): Promise<TextMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let matcher: RegExp;
  try {
    const source = opts.regex
      ? trimmed
      : trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = opts.wholeWord && !opts.regex ? `\\b${source}\\b` : source;
    matcher = new RegExp(body, opts.caseSensitive ? 'g' : 'gi');
  } catch {
    throw new Error('That search pattern is not a valid regular expression');
  }

  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const results: TextMatch[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    for (const raw of content.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = raw as any;
      const str: string = item.str ?? '';
      if (!str) continue;

      matcher.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = matcher.exec(str)) !== null) {
        if (m[0].length === 0) { matcher.lastIndex++; continue; }
        const t = item.transform as number[];
        const fontHeight = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 10;
        const runWidth = item.width ?? 0;
        // Proportional slice of the run — exact glyph metrics are not exposed.
        const startX = t[4] + (runWidth * m.index) / str.length;
        const matchW = (runWidth * m[0].length) / str.length;

        const corners = [
          viewport.convertToViewportPoint(startX, t[5] - fontHeight * 0.25),
          viewport.convertToViewportPoint(startX + matchW, t[5] + fontHeight * 0.95),
        ];
        const xs = [corners[0][0], corners[1][0]];
        const ys = [corners[0][1], corners[1][1]];
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const width = Math.abs(xs[1] - xs[0]);
        const height = Math.abs(ys[1] - ys[0]);

        results.push({
          page: p - 1,
          text: m[0],
          rect: {
            x: x / viewport.width,
            y: y / viewport.height,
            width: Math.max(width / viewport.width, 0.002),
            height: Math.max(height / viewport.height, 0.004),
          },
        });
      }
    }
  }

  return results;
}

/**
 * Burn the redactions in. Pages carrying a redaction are re-rendered to a raster
 * and the marked areas are painted over *before* the image is embedded, so the
 * underlying text and vectors are physically absent from the output — unlike a
 * black rectangle drawn on top, which any viewer can select straight through.
 * Untouched pages are copied across verbatim so quality and size are preserved.
 */
export async function redactPDF(
  file: File,
  redactions: Redaction[],
  options: RedactOptions,
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  if (redactions.length === 0) throw new Error('Mark at least one area to redact');

  const byPage = new Map<number, Redaction[]>();
  for (const r of redactions) {
    const list = byPage.get(r.page) ?? [];
    list.push(r);
    byPage.set(r.page, list);
  }

  const srcDoc = await loadPdf(file);
  const outDoc = await PDFDocument.create();
  const total = srcDoc.getPageCount();

  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const rendered = await pdfjs.getDocument({ data: bytes }).promise;
  const scale = Math.max(0.5, Math.min(4, options.dpi / 72));

  for (let i = 0; i < total; i++) {
    const marks = byPage.get(i);

    if (!marks || marks.length === 0) {
      const [copied] = await outDoc.copyPages(srcDoc, [i]);
      outDoc.addPage(copied);
    } else {
      const page = await rendered.getPage(i + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser blocked canvas rendering');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;

      ctx.fillStyle = options.color;
      for (const mark of marks) {
        ctx.fillRect(
          mark.rect.x * canvas.width,
          mark.rect.y * canvas.height,
          mark.rect.width * canvas.width,
          mark.rect.height * canvas.height
        );
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const image = await outDoc.embedJpg(dataUrl);
      // Page size in points = rendered pixels ÷ scale, which restores the
      // original visual dimensions including any /Rotate already baked in.
      const pageW = canvas.width / scale;
      const pageH = canvas.height / scale;
      const outPage = outDoc.addPage([pageW, pageH]);
      outPage.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
    }

    onProgress?.(Math.round(((i + 1) / total) * 95));
  }

  if (options.stripMetadata) {
    outDoc.setTitle('');
    outDoc.setAuthor('');
    outDoc.setSubject('');
    outDoc.setKeywords([]);
    outDoc.setProducer('ConvertTools');
    outDoc.setCreator('ConvertTools');
  }

  const saved = await outDoc.save({ useObjectStreams: true });
  onProgress?.(100);
  return { blob: toBlob(saved), name: `${baseName(file)}-redacted.pdf` };
}
