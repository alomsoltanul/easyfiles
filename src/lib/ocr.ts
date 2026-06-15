import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolOutput, ProgressFn } from './pdf-tools';

/* eslint-disable @typescript-eslint/no-explicit-any */
let Tesseract: any = null;

async function loadTesseract() {
  if (!Tesseract) {
    const mod = await import('tesseract.js');
    Tesseract = (mod as any).default || mod;
  }
  return Tesseract;
}

interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface PageOcr {
  text: string;
  words: OcrWord[];
  width: number;
  height: number;
  imageDataUrl: string;
}

async function createOcrWorker(language: string) {
  const T = await loadTesseract();
  return T.createWorker(language);
}

async function recognizeCanvas(worker: any, canvas: HTMLCanvasElement): Promise<PageOcr> {
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const words: OcrWord[] = (data.blocks ?? [])
    .flatMap((b: any) => b.paragraphs ?? [])
    .flatMap((p: any) => p.lines ?? [])
    .flatMap((l: any) => l.words ?? [])
    .filter((w: any) => w.text && w.text.trim())
    .map((w: any) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));
  return {
    text: data.text ?? '',
    words,
    width: canvas.width,
    height: canvas.height,
    imageDataUrl: canvas.toDataURL('image/jpeg', 0.9),
  };
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** OCR a PDF or image. outputFormat: 'searchable-pdf' | 'text' | 'json' */
export async function runOCR(
  file: File,
  language: string,
  outputFormat: string,
  onProgress?: ProgressFn
): Promise<ToolOutput> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const pages: PageOcr[] = [];
  const worker = await createOcrWorker(language);

  try {
    if (isPdf) {
      const { renderPagesToCanvases, getPDFPageCount } = await import('./pdf-render');
      const total = await getPDFPageCount(file);
      let done = 0;
      await renderPagesToCanvases(file, 2, async (canvas) => {
        pages.push(await recognizeCanvas(worker, canvas));
        done++;
        onProgress?.(Math.round((done / total) * 90));
      });
    } else {
      onProgress?.(10);
      pages.push(await recognizeCanvas(worker, await fileToCanvas(file)));
      onProgress?.(90);
    }
  } finally {
    await worker.terminate();
  }

  const base = file.name.replace(/\.[^.]+$/, '');

  if (outputFormat === 'text') {
    const text = pages.map((p) => p.text).join('\n\n');
    onProgress?.(100);
    return { blob: new Blob([text], { type: 'text/plain' }), name: `${base}.txt` };
  }

  if (outputFormat === 'json') {
    const json = JSON.stringify(
      pages.map((p, i) => ({ page: i + 1, text: p.text, words: p.words })),
      null,
      2
    );
    onProgress?.(100);
    return { blob: new Blob([json], { type: 'application/json' }), name: `${base}.json` };
  }

  // Searchable PDF: page image + invisible text layer positioned by word bboxes
  const doc = await PDFDocument.create();
  const font = await doc.embedFont('Helvetica');

  for (const page of pages) {
    const img = await doc.embedJpg(page.imageDataUrl);
    // Render at 72dpi-equivalent size (canvas was scaled 2x for OCR accuracy)
    const pageW = page.width / 2;
    const pageH = page.height / 2;
    const pdfPage = doc.addPage([pageW, pageH]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });

    for (const word of page.words) {
      const x = word.bbox.x0 / 2;
      const yTop = word.bbox.y0 / 2;
      const h = Math.max((word.bbox.y1 - word.bbox.y0) / 2, 4);
      pdfPage.drawText(word.text, {
        x,
        y: pageH - yTop - h,
        size: h,
        font,
        opacity: 0,
      });
    }
  }

  doc.setTitle(`${base} (OCR)`);
  doc.setCreator('ConvertTools OCR');
  const bytes = await doc.save();
  onProgress?.(100);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { blob: new Blob([buffer], { type: 'application/pdf' }), name: `${base}-ocr.pdf` };
}

export interface ScanOptions {
  grayscale: boolean;
  brightness: number; // -50..50 (%)
  autoDetect: boolean;
}

async function enhanceCanvas(canvas: HTMLCanvasElement, options: ScanOptions): Promise<void> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const brightnessOffset = (options.brightness / 100) * 128;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (options.grayscale) {
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      // Contrast stretch for crisp document look
      const enhanced = gray < 128 ? Math.max(0, gray - 25) : Math.min(255, gray + 25);
      r = g = b = enhanced;
    }
    data[i] = Math.min(255, Math.max(0, r + brightnessOffset));
    data[i + 1] = Math.min(255, Math.max(0, g + brightnessOffset));
    data[i + 2] = Math.min(255, Math.max(0, b + brightnessOffset));
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Enhance document photos and wrap them in a single PDF. */
export async function scanToPDF(files: File[], options: ScanOptions, onProgress?: ProgressFn): Promise<ToolOutput> {
  if (!files.length) throw new Error('No files provided');

  const doc = await PDFDocument.create();
  const [pageW, pageH] = [595.28, 841.89];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const baseProgress = Math.round((i / total) * 90);
    onProgress?.(baseProgress + 5);

    const canvas = await fileToCanvas(file);
    onProgress?.(baseProgress + 15);

    await enhanceCanvas(canvas, options);
    onProgress?.(baseProgress + 50);

    const jpg = await doc.embedJpg(canvas.toDataURL('image/jpeg', 0.88));
    const page = doc.addPage([pageW, pageH]);
    const scaled = jpg.scaleToFit(pageW - 48, pageH - 48);
    page.drawImage(jpg, {
      x: (pageW - scaled.width) / 2,
      y: (pageH - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
    onProgress?.(baseProgress + 80);
  }

  doc.setTitle('Scanned Document');
  doc.setCreator('ConvertTools Scanner');

  const bytes = await doc.save();
  onProgress?.(100);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return {
    blob: new Blob([buffer], { type: 'application/pdf' }),
    name: total === 1
      ? `${files[0].name.replace(/\.[^.]+$/, '')}-scanned.pdf`
      : 'scanned-document.pdf',
  };
}
