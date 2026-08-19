import { PDFDocument, rgb } from '@cantoo/pdf-lib';

export interface ToolOutput {
  blob: Blob;
  name: string;
}

export type ProgressFn = (percent: number) => void;

export function toBlob(bytes: Uint8Array, type = 'application/pdf'): Blob {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type });
}

export function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '');
}

export async function loadPdf(file: File, password?: string): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      ...(password ? { password } : {}),
    });
  } catch (err) {
    if (err instanceof Error && /password|encrypt/i.test(err.message)) {
      throw new Error('This PDF is password-protected. Use the Unlock tool first.');
    }
    throw err;
  }
}

// ---------- colors ----------

export function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  if (isNaN(int)) return rgb(0, 0, 0);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// ---------- page ranges ----------

/**
 * Parse a human page range ("1-3, 7, 12-") into a sorted list of 1-based page
 * numbers, clamped to `total`. An empty string means "every page".
 */
export function parsePageRange(input: string, total: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return Array.from({ length: total }, (_, i) => i + 1);

  const out = new Set<number>();
  for (const chunk of trimmed.split(/[,\s]+/).filter(Boolean)) {
    const range = chunk.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (range) {
      const from = range[1] ? parseInt(range[1], 10) : 1;
      const to = range[2] ? parseInt(range[2], 10) : total;
      for (let p = Math.max(1, from); p <= Math.min(total, to); p++) out.add(p);
      continue;
    }
    const single = parseInt(chunk, 10);
    if (!isNaN(single) && single >= 1 && single <= total) out.add(single);
  }
  return [...out].sort((a, b) => a - b);
}

// ---------- rotation-aware geometry ----------

export interface NormRect {
  /** 0..1 from the left edge of the rendered (rotated) page */
  x: number;
  /** 0..1 from the top edge of the rendered (rotated) page */
  y: number;
  width: number;
  height: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * pdf.js renders a page with its /Rotate applied, so on-screen coordinates do
 * not line up with the coordinates pdf-lib draws in. These helpers convert a
 * point or rect picked on the rendered page back into unrotated PDF user space.
 *
 * `w` / `h` are the *unrotated* page dimensions; `rotation` is 0 | 90 | 180 | 270.
 */
export function visualPointToPdf(
  nx: number,
  ny: number,
  w: number,
  h: number,
  rotation: number
): { x: number; y: number } {
  const r = ((rotation % 360) + 360) % 360;
  switch (r) {
    case 90:
      // dx = v, dy = u  (rendered size is h × w)
      return { x: ny * w, y: nx * h };
    case 180:
      // dx = w - u, dy = v
      return { x: (1 - nx) * w, y: ny * h };
    case 270:
      // dx = h - v, dy = w - u
      return { x: (1 - ny) * w, y: (1 - nx) * h };
    default:
      return { x: nx * w, y: (1 - ny) * h };
  }
}

/**
 * Convert a rect picked on the rendered page into unrotated PDF user space.
 * The returned rect is axis-aligned in PDF space (widths/heights swap at 90/270).
 */
export function visualRectToPdf(
  rect: NormRect,
  w: number,
  h: number,
  rotation: number
): PdfRect {
  const r = ((rotation % 360) + 360) % 360;
  const { x, y, width, height } = rect;
  switch (r) {
    case 90:
      return { x: y * w, y: x * h, width: height * w, height: width * h };
    case 180:
      return { x: (1 - x - width) * w, y: y * h, width: width * w, height: height * h };
    case 270:
      return { x: (1 - y - height) * w, y: (1 - x - width) * h, width: height * w, height: width * h };
    default:
      return { x: x * w, y: (1 - y - height) * h, width: width * w, height: height * h };
  }
}

/**
 * PDF-space anchor for an item whose visual bottom-left corner sits at
 * (nx, ny + nh) on the rendered page. Items drawn at this anchor with
 * `rotate: degrees(rotation)` come out upright in the viewer.
 */
export function visualAnchorToPdf(
  nx: number,
  nyBottom: number,
  w: number,
  h: number,
  rotation: number
): { x: number; y: number } {
  return visualPointToPdf(nx, nyBottom, w, h, rotation);
}

/** Rendered (rotated) page size for a given unrotated size. */
export function renderedSize(w: number, h: number, rotation: number) {
  const r = ((rotation % 360) + 360) % 360;
  return r === 90 || r === 270 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * Inverse of `visualPointToPdf` — take a point in unrotated PDF user space
 * (relative to the page origin) back to 0..1 coordinates on the rendered page.
 */
export function pdfPointToVisual(
  px: number,
  py: number,
  w: number,
  h: number,
  rotation: number
): { x: number; y: number } {
  const r = ((rotation % 360) + 360) % 360;
  switch (r) {
    case 90:
      return { x: py / h, y: px / w };
    case 180:
      return { x: 1 - px / w, y: py / h };
    case 270:
      return { x: 1 - py / h, y: 1 - px / w };
    default:
      return { x: px / w, y: 1 - py / h };
  }
}

/** Inverse of `visualRectToPdf`. `rect.y` is the PDF-space *bottom* edge. */
export function pdfRectToVisual(
  rect: PdfRect,
  w: number,
  h: number,
  rotation: number
): NormRect {
  const r = ((rotation % 360) + 360) % 360;
  const { x, y, width, height } = rect;
  switch (r) {
    case 90:
      return { x: y / h, y: x / w, width: height / h, height: width / w };
    case 180:
      return { x: 1 - (x + width) / w, y: y / h, width: width / w, height: height / h };
    case 270:
      return { x: 1 - (y + height) / h, y: 1 - (x + width) / w, width: height / h, height: width / w };
    default:
      return { x: x / w, y: 1 - (y + height) / h, width: width / w, height: height / h };
  }
}

/**
 * How far a run of horizontal PDF text is turned when the page is displayed
 * with its /Rotate applied. Text laid out along +x in user space runs to the
 * right at 0°, downwards at 90°, and so on.
 */
export function textScreenAngle(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
