// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

async function getPDFJS() {
  if (!pdfjsLib) {
    const mod = await import('pdfjs-dist');
    pdfjsLib = mod;
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

async function renderPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  pageNum: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas;
}

/** Render a single page to a live canvas (caller owns it). */
export async function renderPageToCanvas(
  file: File,
  pageNum: number,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  return renderPage(pdf, pageNum, scale);
}

/** Page geometry as pdf.js sees it — unrotated size plus the /Rotate value. */
export async function getPageGeometry(
  file: File
): Promise<{ width: number; height: number; rotation: number }[]> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const out: { width: number; height: number; rotation: number }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1, rotation: 0 });
    out.push({ width: vp.width, height: vp.height, rotation: page.rotate ?? 0 });
  }
  return out;
}

export async function renderPDFPage(file: File, pageNum: number, scale: number = 1.5): Promise<string> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const canvas = await renderPage(pdf, pageNum, scale);
  return canvas.toDataURL('image/png');
}

/** Render every page to a canvas, invoking the callback per page (0-based index). */
export async function renderPagesToCanvases(
  file: File,
  scale: number,
  onPage: (canvas: HTMLCanvasElement, pageIndex: number) => Promise<void> | void
): Promise<void> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const canvas = await renderPage(pdf, i, scale);
    await onPage(canvas, i - 1);
  }
}

export async function convertPDFToImages(
  file: File,
  format: 'jpeg' | 'png' = 'jpeg',
  scale: number = 1.5,
  onProgress?: (percent: number) => void
): Promise<{ name: string; blob: Blob; pageNum: number }[]> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const total = pdf.numPages;
  const baseName = file.name.replace(/\.pdf$/i, '');
  const results: { name: string; blob: Blob; pageNum: number }[] = [];

  for (let i = 1; i <= total; i++) {
    const canvas = await renderPage(pdf, i, scale);
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to convert page to image'));
      }, mimeType, 0.92);
    });
    results.push({ name: `${baseName}-page-${i}.${ext}`, blob, pageNum: i });
    onProgress?.(Math.round((i / total) * 100));
  }

  return results;
}

export async function getPDFPageCount(file: File): Promise<number> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  return pdf.numPages;
}

export async function renderPDFThumbnails(file: File, scale: number = 0.5): Promise<string[]> {
  const pdfjs = await getPDFJS();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const thumbnails: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const canvas = await renderPage(pdf, i, scale);
    thumbnails.push(canvas.toDataURL('image/png'));
  }
  return thumbnails;
}
