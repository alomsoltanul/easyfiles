import { loadPdf, toBlob, baseName, parsePageRange, renderedSize, visualRectToPdf } from './pdf-common';
import type { NormRect, ToolOutput } from './pdf-common';

export interface CropMargins {
  /** Points trimmed from each edge, as seen on the rendered page. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropOptions {
  mode: 'margins' | 'rect';
  margins: CropMargins;
  /** Selection drawn on the rendered page, normalised 0..1. */
  rect: NormRect;
  /** Empty means every page. */
  pageRange: string;
  /**
   * Also shrink the MediaBox. Keeps the crop visible in viewers that ignore
   * CropBox, at the cost of discarding the trimmed area for good.
   */
  shrinkMediaBox: boolean;
}

export const DEFAULT_CROP_OPTIONS: CropOptions = {
  mode: 'margins',
  margins: { top: 36, right: 36, bottom: 36, left: 36 },
  rect: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
  pageRange: '',
  shrinkMediaBox: true,
};

const MIN_SIZE = 12; // points — refuse to crop a page into nothing

/** Margins (visual points) → normalised visual rect for a given rendered size. */
export function marginsToRect(m: CropMargins, viewW: number, viewH: number): NormRect {
  const x = m.left / viewW;
  const y = m.top / viewH;
  const width = Math.max(0, (viewW - m.left - m.right) / viewW);
  const height = Math.max(0, (viewH - m.top - m.bottom) / viewH);
  return { x, y, width, height };
}

export async function cropPDF(file: File, options: CropOptions): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  const pages = doc.getPages();
  const targets = new Set(parsePageRange(options.pageRange, pages.length));
  if (targets.size === 0) throw new Error('The page range does not match any page in this document');

  let cropped = 0;

  for (let i = 0; i < pages.length; i++) {
    if (!targets.has(i + 1)) continue;
    const page = pages[i];
    const box = page.getMediaBox();
    const rotation = page.getRotation().angle;
    const view = renderedSize(box.width, box.height, rotation);

    const visual = options.mode === 'margins'
      ? marginsToRect(options.margins, view.width, view.height)
      : options.rect;

    if (visual.width <= 0 || visual.height <= 0) {
      throw new Error(`Crop area is empty on page ${i + 1} — reduce the margins`);
    }

    const r = visualRectToPdf(visual, box.width, box.height, rotation);
    const x = box.x + Math.max(0, r.x);
    const y = box.y + Math.max(0, r.y);
    const width = Math.min(r.width, box.width - Math.max(0, r.x));
    const height = Math.min(r.height, box.height - Math.max(0, r.y));

    if (width < MIN_SIZE || height < MIN_SIZE) {
      throw new Error(`Crop area on page ${i + 1} is smaller than ${MIN_SIZE}pt — reduce the margins`);
    }

    page.setCropBox(x, y, width, height);
    if (options.shrinkMediaBox) page.setMediaBox(x, y, width, height);
    // Keep the other boxes inside the new crop so print pipelines stay valid.
    page.setBleedBox(x, y, width, height);
    page.setTrimBox(x, y, width, height);
    cropped++;
  }

  if (cropped === 0) throw new Error('No pages were cropped');

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-cropped.pdf` };
}

/**
 * Find the content bounding box of a rendered page by scanning for pixels that
 * differ from the page background. Returns a normalised visual rect, padded a
 * little so glyph edges are not clipped.
 */
export function detectContentRect(canvas: HTMLCanvasElement, padding = 6): NormRect | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (!width || !height) return null;

  const { data } = ctx.getImageData(0, 0, width, height);
  // Sample the corners to learn the background colour (handles dark pages too).
  const corner = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const bg = corner(0, 0);
  const tolerance = 24;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue; // transparent
      if (
        Math.abs(data[i] - bg[0]) <= tolerance &&
        Math.abs(data[i + 1] - bg[1]) <= tolerance &&
        Math.abs(data[i + 2] - bg[2]) <= tolerance
      ) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null; // blank page

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  return {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  };
}
