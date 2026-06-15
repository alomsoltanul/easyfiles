import { PDFDocument, degrees, rgb, StandardFonts } from '@cantoo/pdf-lib';

export interface ToolOutput {
  blob: Blob;
  name: string;
}

export type ProgressFn = (percent: number) => void;

function toBlob(bytes: Uint8Array, type = 'application/pdf'): Blob {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type });
}

function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '');
}

async function loadPdf(file: File, password?: string): Promise<PDFDocument> {
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

// ---------- merge ----------

export async function mergePDFs(files: File[], onProgress?: ProgressFn): Promise<ToolOutput> {
  const mergedDoc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const doc = await loadPdf(files[i]);
    const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => mergedDoc.addPage(page));
    onProgress?.(Math.round(((i + 1) / files.length) * 90));
  }
  const bytes = await mergedDoc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: 'merged.pdf' };
}

// ---------- split / extract / delete / reorder / rotate ----------

async function copyPagesToNewDoc(srcDoc: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(srcDoc, indices);
  pages.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

/** pages are 1-based page numbers */
export async function splitPDF(
  file: File,
  mode: 'selected' | 'all',
  pages: number[],
  onProgress?: ProgressFn
): Promise<ToolOutput | ToolOutput[]> {
  const srcDoc = await loadPdf(file);
  const total = srcDoc.getPageCount();
  const base = baseName(file);

  if (mode === 'all') {
    const results: ToolOutput[] = [];
    for (let i = 0; i < total; i++) {
      const bytes = await copyPagesToNewDoc(srcDoc, [i]);
      results.push({ blob: toBlob(bytes), name: `${base}-page-${i + 1}.pdf` });
      onProgress?.(Math.round(((i + 1) / total) * 100));
    }
    return results;
  }

  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < total);
  if (indices.length === 0) throw new Error('No valid pages selected');
  const bytes = await copyPagesToNewDoc(srcDoc, indices);
  onProgress?.(100);
  return { blob: toBlob(bytes), name: `${base}-split.pdf` };
}

/** pages are 1-based page numbers */
export async function extractPages(file: File, pages: number[]): Promise<ToolOutput> {
  const srcDoc = await loadPdf(file);
  const total = srcDoc.getPageCount();
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
  if (indices.length === 0) throw new Error('No valid pages selected');
  const bytes = await copyPagesToNewDoc(srcDoc, indices);
  return { blob: toBlob(bytes), name: `${baseName(file)}-extracted.pdf` };
}

/** pages are 1-based page numbers to delete */
export async function deletePages(file: File, pages: number[]): Promise<ToolOutput> {
  const srcDoc = await loadPdf(file);
  const total = srcDoc.getPageCount();
  const toDelete = new Set(pages);
  const keep: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!toDelete.has(i + 1)) keep.push(i);
  }
  if (keep.length === 0) throw new Error('Cannot delete every page');
  const bytes = await copyPagesToNewDoc(srcDoc, keep);
  return { blob: toBlob(bytes), name: `${baseName(file)}-edited.pdf` };
}

/** order is the full list of 1-based page numbers in their new order */
export async function reorderPages(file: File, order: number[]): Promise<ToolOutput> {
  const srcDoc = await loadPdf(file);
  const total = srcDoc.getPageCount();
  const indices = order.map((p) => p - 1).filter((i) => i >= 0 && i < total);
  if (indices.length !== total) throw new Error('Page order must include every page exactly once');
  const bytes = await copyPagesToNewDoc(srcDoc, indices);
  return { blob: toBlob(bytes), name: `${baseName(file)}-reordered.pdf` };
}

/** pages: 1-based page numbers, or undefined for all pages */
export async function rotatePDF(file: File, angle: 90 | 180 | 270, pages?: number[]): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  const targets = pages && pages.length > 0 ? new Set(pages) : null;
  doc.getPages().forEach((page, i) => {
    if (targets && !targets.has(i + 1)) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  });
  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-rotated.pdf` };
}

// ---------- compress ----------

export async function compressPDF(
  file: File,
  level: 'low' | 'medium' | 'high',
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  const name = `${baseName(file)}-compressed.pdf`;

  if (level === 'low') {
    // Lossless: rewrite with object streams, strip junk metadata
    const doc = await loadPdf(file);
    doc.setProducer('ConvertTools');
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    onProgress?.(100);
    return { blob: toBlob(bytes), name };
  }

  // Lossy: re-render each page to JPEG and rebuild the PDF
  const { renderPagesToCanvases } = await import('./pdf-render');
  const scale = level === 'medium' ? 1.5 : 1.1;
  const quality = level === 'medium' ? 0.72 : 0.5;

  const srcDoc = await loadPdf(file);
  const pageSizes = srcDoc.getPages().map((p) => p.getSize());

  const newDoc = await PDFDocument.create();
  let done = 0;
  const total = pageSizes.length;

  await renderPagesToCanvases(file, scale, async (canvas, pageIndex) => {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const jpg = await newDoc.embedJpg(dataUrl);
    const { width, height } = pageSizes[pageIndex] ?? { width: canvas.width, height: canvas.height };
    const page = newDoc.addPage([width, height]);
    page.drawImage(jpg, { x: 0, y: 0, width, height });
    done++;
    onProgress?.(Math.round((done / total) * 95));
  });

  const bytes = await newDoc.save({ useObjectStreams: true });
  onProgress?.(100);

  // If "compression" grew the file (text-heavy PDFs), fall back to lossless
  if (bytes.length >= file.size) {
    return compressPDF(file, 'low');
  }
  return { blob: toBlob(bytes), name };
}

// ---------- pdf -> images ----------

export async function pdfToImages(
  file: File,
  format: 'jpeg' | 'png',
  dpi: number,
  onProgress?: ProgressFn
): Promise<ToolOutput[]> {
  const { convertPDFToImages } = await import('./pdf-render');
  const scale = Math.max(0.5, Math.min(4, dpi / 72));
  const images = await convertPDFToImages(file, format, scale, onProgress);
  return images.map((img) => ({ blob: img.blob, name: img.name }));
}

// ---------- images -> pdf ----------

export interface ImagesToPdfOptions {
  pageSize: 'A4' | 'Letter' | 'Fit';
  orientation: 'portrait' | 'landscape';
  fitMode: 'contain' | 'cover' | 'stretch';
}

const PAGE_DIMENSIONS: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

async function fileToEmbeddable(file: File): Promise<{ data: ArrayBuffer | string; kind: 'jpg' | 'png' }> {
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    return { data: await file.arrayBuffer(), kind: 'jpg' };
  }
  if (file.type === 'image/png') {
    return { data: await file.arrayBuffer(), kind: 'png' };
  }
  // WebP and anything else: re-encode through canvas to PNG
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not read image: ${file.name}`));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { data: canvas.toDataURL('image/png'), kind: 'png' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function imagesToPDF(
  files: File[],
  options: ImagesToPdfOptions,
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  const doc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const { data, kind } = await fileToEmbeddable(files[i]);
    const image = kind === 'jpg' ? await doc.embedJpg(data) : await doc.embedPng(data);

    let pageW: number, pageH: number;
    if (options.pageSize === 'Fit') {
      pageW = image.width;
      pageH = image.height;
    } else {
      const [w, h] = PAGE_DIMENSIONS[options.pageSize] ?? PAGE_DIMENSIONS.A4;
      [pageW, pageH] = options.orientation === 'landscape' ? [h, w] : [w, h];
    }

    const page = doc.addPage([pageW, pageH]);

    if (options.pageSize === 'Fit' || options.fitMode === 'stretch') {
      page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
    } else {
      const margin = 24;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const ratio = options.fitMode === 'cover'
        ? Math.max(availW / image.width, availH / image.height)
        : Math.min(availW / image.width, availH / image.height);
      const w = image.width * ratio;
      const h = image.height * ratio;
      page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    }
    onProgress?.(Math.round(((i + 1) / files.length) * 95));
  }

  const bytes = await doc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: 'images.pdf' };
}

// ---------- watermark ----------

export interface WatermarkOptions {
  text?: string;
  opacity: number;
  rotation: number;
  position: string;
  size: number;
}

export async function watermarkPDF(
  file: File,
  options: WatermarkOptions,
  imageFile?: File
): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  const font = options.text ? await doc.embedFont(StandardFonts.HelveticaBold) : null;

  let image = null;
  if (!options.text && imageFile) {
    const { data, kind } = await fileToEmbeddable(imageFile);
    image = kind === 'jpg' ? await doc.embedJpg(data) : await doc.embedPng(data);
  }
  if (!options.text && !image) throw new Error('Provide watermark text or an image');

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();

    let itemW: number, itemH: number;
    if (font && options.text) {
      itemW = font.widthOfTextAtSize(options.text, options.size);
      itemH = font.heightAtSize(options.size);
    } else {
      const scaled = image!.scaleToFit(width * 0.5, height * 0.5);
      itemW = scaled.width;
      itemH = scaled.height;
    }

    const margin = 36;
    let x: number, y: number;
    switch (options.position) {
      case 'top-left': x = margin; y = height - margin - itemH; break;
      case 'top-right': x = width - margin - itemW; y = height - margin - itemH; break;
      case 'bottom-left': x = margin; y = margin; break;
      case 'bottom-right': x = width - margin - itemW; y = margin; break;
      default: x = (width - itemW) / 2; y = (height - itemH) / 2;
    }

    if (font && options.text) {
      page.drawText(options.text, {
        x, y,
        size: options.size,
        font,
        color: rgb(0.4, 0.4, 0.4),
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      });
    } else {
      page.drawImage(image!, {
        x, y,
        width: itemW,
        height: itemH,
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      });
    }
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-watermarked.pdf` };
}

// ---------- protect / unlock ----------

export interface ProtectPermissions {
  printing: boolean;
  modifying: boolean;
  copying: boolean;
  annotating: boolean;
}

export async function protectPDF(
  file: File,
  password: string,
  permissions: ProtectPermissions
): Promise<ToolOutput> {
  if (!password) throw new Error('Password is required');
  const doc = await loadPdf(file);
  doc.encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: permissions.printing ? 'highResolution' : false,
      modifying: permissions.modifying,
      copying: permissions.copying,
      annotating: permissions.annotating,
    },
  });
  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-protected.pdf` };
}

export async function unlockPDF(file: File, password: string): Promise<ToolOutput> {
  const bytes = await file.arrayBuffer();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: password || undefined });
  } catch {
    throw new Error('Incorrect password — could not unlock this PDF');
  }
  // Re-save without calling encrypt(): output is unencrypted
  let saved: Uint8Array;
  try {
    saved = await doc.save();
  } catch {
    throw new Error('Incorrect password — could not unlock this PDF');
  }
  return { blob: toBlob(saved), name: `${baseName(file)}-unlocked.pdf` };
}

// ---------- sign ----------

export interface SignOptions {
  signatureType: 'draw' | 'type' | 'upload';
  signatureData: string; // text, or a data URL for draw/upload
  page?: number; // 1-based; defaults to last page
  position?: string; // same positions as watermark; defaults to bottom-right
}

export async function signPDF(file: File, options: SignOptions): Promise<ToolOutput> {
  if (!options.signatureData) throw new Error('Provide a signature first');
  const doc = await loadPdf(file);
  const pages = doc.getPages();
  const pageIndex = options.page ? Math.min(Math.max(options.page - 1, 0), pages.length - 1) : pages.length - 1;
  const page = pages[pageIndex];
  const { width } = page.getSize();
  const margin = 48;

  if (options.signatureType === 'type') {
    const font = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const size = 28;
    const textW = font.widthOfTextAtSize(options.signatureData, size);
    page.drawText(options.signatureData, {
      x: width - margin - textW,
      y: margin,
      size,
      font,
      color: rgb(0.1, 0.1, 0.35),
    });
  } else {
    let dataUrl = options.signatureData;
    if (!/^data:image\/(png|jpe?g)/.test(dataUrl)) {
      // Normalize WebP/other formats to PNG via canvas
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not read signature image'));
        el.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      dataUrl = canvas.toDataURL('image/png');
    }
    const isPng = dataUrl.startsWith('data:image/png');
    const image = isPng
      ? await doc.embedPng(dataUrl)
      : await doc.embedJpg(dataUrl);
    const scaled = image.scaleToFit(220, 90);
    page.drawImage(image, {
      x: width - margin - scaled.width,
      y: margin,
      width: scaled.width,
      height: scaled.height,
    });
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-signed.pdf` };
}

// ---------- metadata ----------

export interface MetadataFields {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creationDate?: string;
}

export async function setPDFMetadata(file: File, fields: MetadataFields): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  if (fields.title !== undefined) doc.setTitle(fields.title);
  if (fields.author !== undefined) doc.setAuthor(fields.author);
  if (fields.subject !== undefined) doc.setSubject(fields.subject);
  if (fields.keywords !== undefined) {
    doc.setKeywords(fields.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  }
  if (fields.creationDate) {
    const date = new Date(fields.creationDate);
    if (!isNaN(date.getTime())) doc.setCreationDate(date);
  }
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-metadata.pdf` };
}

export async function getPDFMetadata(file: File): Promise<Required<MetadataFields>> {
  const doc = await loadPdf(file);
  const creation = doc.getCreationDate();
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    creationDate: creation ? creation.toISOString().slice(0, 10) : '',
  };
}

// ---------- page count helper ----------

export async function getPDFPageCount(file: File): Promise<number> {
  const doc = await loadPdf(file);
  return doc.getPageCount();
}
