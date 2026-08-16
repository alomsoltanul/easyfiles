import { PDFDocument } from '@cantoo/pdf-lib';
import { applyAnnotations, type Annotation } from './pdf-annotate';
import { renderPagesToCanvases } from './pdf-render';

export type ExportMode = 'editable' | 'flat';

const asFile = (blob: Blob, name: string) => new File([blob], name, { type: 'application/pdf' });

const isIdentity = (order: number[], total: number) =>
  order.length === total && order.every((value, index) => value === index);

/** Rebuild the document so its pages follow `order` (dropping anything not listed). */
async function reorderPages(blob: Blob, order: number[]): Promise<Blob> {
  const source = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const target = await PDFDocument.create();
  const copied = await target.copyPages(source, order);
  copied.forEach((page) => target.addPage(page));
  const bytes = await target.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/**
 * Rasterise every page and rebuild the file from those images, so edits and
 * cover-ups are burned in and nothing underneath stays selectable.
 */
async function flatten(blob: Blob, name: string, onProgress?: (pct: number) => void): Promise<Blob> {
  const doc = await PDFDocument.create();
  const source = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const sizes = source.getPages().map((page) => {
    const { width, height } = page.getSize();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    return angle === 90 || angle === 270 ? { width: height, height: width } : { width, height };
  });

  await renderPagesToCanvases(asFile(blob, name), 2, async (canvas, index) => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const image = await doc.embedJpg(dataUrl);
    const size = sizes[index] ?? { width: image.width / 2, height: image.height / 2 };
    const page = doc.addPage([size.width, size.height]);
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    onProgress?.(Math.round(((index + 1) / sizes.length) * 100));
  });

  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/**
 * Produce the final PDF: annotations applied, pages ordered as the editor shows
 * them, optionally flattened.
 */
export async function finalizeEdit(options: {
  file: File;
  annotations: Annotation[];
  pageOrder: number[];
  totalPages: number;
  mode: ExportMode;
  name: string;
  onProgress?: (pct: number) => void;
}): Promise<Blob> {
  const { file, annotations, pageOrder, totalPages, mode, name, onProgress } = options;

  let blob: Blob = file;
  if (annotations.length > 0) {
    onProgress?.(10);
    blob = (await applyAnnotations(file, annotations)).blob;
  }

  if (!isIdentity(pageOrder, totalPages)) {
    onProgress?.(35);
    blob = await reorderPages(blob, pageOrder);
  }

  if (mode === 'flat') {
    onProgress?.(50);
    blob = await flatten(blob, name, (pct) => onProgress?.(50 + pct / 2));
  }

  onProgress?.(100);
  return blob;
}
