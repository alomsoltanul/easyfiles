import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import type { ToolOutput, ProgressFn } from './pdf-tools';

function toBlob(bytes: Uint8Array, type = 'application/pdf'): Blob {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type });
}

function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '');
}

// ---------- Word (DOCX) -> PDF ----------

export async function wordToPDF(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(20);
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });
  onProgress?.(45);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * 1.4;

  const paragraphs = text.split(/\n+/);

  function wrap(line: string): string[] {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const out: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (current) out.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) out.push(current);
    return out;
  }

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (let p = 0; p < paragraphs.length; p++) {
    const lines = wrap(paragraphs[p]);
    for (const line of lines) {
      if (y - lineHeight < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
    y -= lineHeight * 0.4;
    onProgress?.(45 + Math.round(((p + 1) / paragraphs.length) * 50));
  }

  const bytes = await doc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: `${baseName(file)}.pdf` };
}

// ---------- Excel (XLSX/CSV) -> PDF ----------

export async function excelToPDF(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(15);
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  onProgress?.(35);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 9;
  const margin = 30;
  const pageWidth = 792; // landscape letter
  const pageHeight = 612;

  const sheets = workbook.SheetNames;
  for (let si = 0; si < sheets.length; si++) {
    const name = sheets[si];
    const sheet = workbook.Sheets[name];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

    const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0) || 1;
    const colWidth = (pageWidth - margin * 2) / colCount;
    const rowHeight = fontSize * 1.6;

    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText(name, { x: margin, y: y - 14, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 24;

    for (let ri = 0; ri < rows.length; ri++) {
      if (y - rowHeight < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      const row = rows[ri];
      const isHeader = ri === 0;
      for (let ci = 0; ci < colCount; ci++) {
        const cellRaw = row[ci] == null ? '' : String(row[ci]);
        const maxChars = Math.max(3, Math.floor(colWidth / (fontSize * 0.55)));
        const cell = cellRaw.length > maxChars ? cellRaw.slice(0, maxChars - 1) + '…' : cellRaw;
        const x = margin + ci * colWidth;
        if (isHeader) {
          page.drawRectangle({ x, y: y - rowHeight + 2, width: colWidth, height: rowHeight - 2, color: rgb(0.94, 0.96, 0.98) });
        }
        page.drawText(cell, { x: x + 3, y: y - fontSize - 2, size: fontSize, font: isHeader ? bold : font, color: rgb(0, 0, 0) });
      }
      // horizontal line
      page.drawLine({ start: { x: margin, y: y - rowHeight + 1 }, end: { x: pageWidth - margin, y: y - rowHeight + 1 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
      y -= rowHeight;
      if (ri % 25 === 0) onProgress?.(35 + Math.round((si / sheets.length) * 60) + Math.round((ri / rows.length) * 10));
    }
  }

  const bytes = await doc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: `${baseName(file)}.pdf` };
}

// ---------- PowerPoint (PPTX) -> PDF ----------

async function extractPptxSlides(file: File): Promise<{ title: string; body: string[] }[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)![1]);
      const nb = Number(b.match(/slide(\d+)/)![1]);
      return na - nb;
    });

  const slides: { title: string; body: string[] }[] = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string');
    const texts: string[] = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) texts.push(t);
    }
    if (texts.length === 0) {
      slides.push({ title: '', body: [] });
      continue;
    }
    slides.push({ title: texts[0], body: texts.slice(1) });
  }
  return slides;
}

export async function powerpointToPDF(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const slides = await extractPptxSlides(file);
  onProgress?.(30);

  const doc = await PDFDocument.create();
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  // Standard 4:3 slide 720x540 pt
  const pageWidth = 720;
  const pageHeight = 540;
  const margin = 40;

  slides.forEach((slide, i) => {
    const page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    if (slide.title) {
      page.drawText(slide.title, { x: margin, y: y - 28, size: 28, font: titleFont, color: rgb(0.1, 0.15, 0.25) });
      y -= 50;
    }

    const bodySize = 16;
    const lineHeight = bodySize * 1.5;
    for (const item of slide.body) {
      if (y - lineHeight < margin) break;
      const bullet = `• ${item}`;
      // simple truncation
      const maxWidth = pageWidth - margin * 2;
      const width = bodyFont.widthOfTextAtSize(bullet, bodySize);
      let text = bullet;
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        text = bullet.slice(0, Math.floor(bullet.length * ratio) - 1) + '…';
      }
      page.drawText(text, { x: margin, y: y - bodySize, size: bodySize, font: bodyFont, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
    }

    // Slide number footer
    const num = `${i + 1} / ${slides.length}`;
    page.drawText(num, {
      x: pageWidth - margin - bodyFont.widthOfTextAtSize(num, 10),
      y: 20,
      size: 10,
      font: bodyFont,
      color: rgb(0.55, 0.55, 0.55),
    });

    onProgress?.(30 + Math.round(((i + 1) / slides.length) * 65));
  });

  const bytes = await doc.save();
  onProgress?.(100);
  return { blob: toBlob(bytes), name: `${baseName(file)}.pdf` };
}

// ---------- PDF -> Word (DOCX) ----------

async function extractPdfTextPerPage(file: File, onProgress?: (p: number) => void): Promise<string[]> {
  const { renderPagesToCanvases } = await import('./pdf-render');
  // Actually we want text extraction — use pdfjs directly
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strs: string[] = (content.items as any[]).map((it) => it.str ?? '');
    pages.push(strs.join(' ').replace(/\s+/g, ' ').trim());
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }
  // silence unused import
  void renderPagesToCanvases;
  return pages;
}

export async function pdfToWord(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const pagesText = await extractPdfTextPerPage(file, (p) => onProgress?.(Math.round(p * 0.6)));
  onProgress?.(65);

  const docxMod = await import('docx');
  const { Document, Packer, Paragraph, TextRun, PageBreak } = docxMod;

  const children: InstanceType<typeof Paragraph>[] = [];
  pagesText.forEach((text, idx) => {
    const paragraphs = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const p of paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(p)] }));
    }
    if (idx < pagesText.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const document = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(document);
  onProgress?.(100);
  return { blob, name: `${baseName(file)}.docx` };
}

// ---------- PDF -> Excel (XLSX) ----------

async function extractPdfLinesPerPage(file: File, onProgress?: (p: number) => void): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by Y position into lines
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = content.items as any[];
    const map = new Map<number, string[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(it.str);
    }
    const lines = Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.join(' ').trim())
      .filter(Boolean);
    pages.push(lines);
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }
  return pages;
}

export async function pdfToExcel(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const pagesLines = await extractPdfLinesPerPage(file, (p) => onProgress?.(Math.round(p * 0.7)));
  onProgress?.(75);

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  pagesLines.forEach((lines, idx) => {
    // Split each line on multi-space runs into columns
    const rows = lines.map((line) => line.split(/\s{2,}|\t/).map((c) => c.trim()));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, `Page ${idx + 1}`.slice(0, 31));
  });

  const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  onProgress?.(100);
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    name: `${baseName(file)}.xlsx`,
  };
}

// ---------- PDF -> PowerPoint (PPTX) ----------

export async function pdfToPowerPoint(file: File, onProgress?: ProgressFn): Promise<ToolOutput> {
  const { convertPDFToImages } = await import('./pdf-render');
  const images = await convertPDFToImages(file, 'jpeg', 2, (p) => onProgress?.(Math.round(p * 0.7)));
  onProgress?.(75);

  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  for (const img of images) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(img.blob);
    });
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
  }

  const blobLike = (await pptx.write({ outputType: 'blob' })) as Blob;
  onProgress?.(100);
  return { blob: blobLike, name: `${baseName(file)}.pptx` };
}
