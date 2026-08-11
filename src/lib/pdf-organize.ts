import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { loadPdf, toBlob } from './pdf-common';
import type { ProgressFn, ToolOutput } from './pdf-common';

/** One slot in the page manager: either a copied source page or a blank sheet. */
export type OrganizeItem =
  | {
      kind: 'page';
      /** Stable id so React keys survive reordering. */
      id: string;
      /** Index into the `files` array passed to organizePDF. */
      sourceIndex: number;
      /** 0-based page index inside that source file. */
      pageIndex: number;
      /** Extra rotation applied on top of the page's own /Rotate. */
      rotation: number;
    }
  | {
      kind: 'blank';
      id: string;
      width: number;
      height: number;
    };

export const BLANK_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
};

export async function organizePDF(
  files: File[],
  items: OrganizeItem[],
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  if (items.length === 0) throw new Error('The document would be empty — keep at least one page');

  const out = await PDFDocument.create();

  // Load each source once, then copy in document order.
  const sources = new Map<number, PDFDocument>();
  for (const item of items) {
    if (item.kind !== 'page') continue;
    if (!sources.has(item.sourceIndex)) {
      const f = files[item.sourceIndex];
      if (!f) throw new Error('A source file referenced by the page list is missing');
      sources.set(item.sourceIndex, await loadPdf(f));
    }
  }

  let done = 0;
  for (const item of items) {
    if (item.kind === 'blank') {
      out.addPage([item.width, item.height]);
    } else {
      const src = sources.get(item.sourceIndex)!;
      if (item.pageIndex < 0 || item.pageIndex >= src.getPageCount()) {
        throw new Error(`Page ${item.pageIndex + 1} does not exist in ${files[item.sourceIndex].name}`);
      }
      // Copied page objects can only be added once, so duplicates get a fresh copy.
      const [page] = await out.copyPages(src, [item.pageIndex]);
      const base = page.getRotation().angle;
      page.setRotation(degrees((((base + item.rotation) % 360) + 360) % 360));
      out.addPage(page);
    }
    done++;
    onProgress?.(Math.round((done / items.length) * 95));
  }

  const bytes = await out.save();
  onProgress?.(100);
  const first = files[0];
  const base = first ? first.name.replace(/\.[^.]+$/, '') : 'document';
  return { blob: toBlob(bytes), name: `${base}-organized.pdf` };
}
