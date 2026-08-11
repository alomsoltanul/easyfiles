import { PDFDocument } from '@cantoo/pdf-lib';
import { toBlob, baseName } from './pdf-common';
import type { ProgressFn, ToolOutput } from './pdf-common';

export interface Diagnostics {
  size: number;
  headerFound: boolean;
  /** Bytes of junk before `%PDF-` — some downloads prepend HTML error pages. */
  headerOffset: number;
  version: string | null;
  eofFound: boolean;
  startxrefFound: boolean;
  encrypted: boolean;
  linearized: boolean;
  objectsFound: number;
  catalogFound: boolean;
  /** Whether a strict parse (pdf-lib) succeeded. */
  strictParse: boolean;
  /** Whether the lenient parser (pdf.js) could open it. */
  lenientParse: boolean;
  pageCount: number | null;
  notes: string[];
}

export type RepairMethod = 'rewrite' | 'trim' | 'rebuild-xref' | 'rasterize';

export interface RepairOptions {
  /**
   * Allow the last-resort salvage that re-renders every readable page into a
   * fresh document. It always produces a file, but the text layer is lost.
   */
  allowRasterSalvage: boolean;
  /** Raster salvage resolution. */
  dpi: number;
  /** Drop encryption if the document opens without a password. */
  removeEncryption: boolean;
}

export const DEFAULT_REPAIR_OPTIONS: RepairOptions = {
  allowRasterSalvage: true,
  dpi: 150,
  removeEncryption: true,
};

export interface RepairResult extends ToolOutput {
  method: RepairMethod;
  log: string[];
  pages: number;
  diagnostics: Diagnostics;
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

/** Latin-1 view of the bytes: string index === byte offset, so offsets stay exact. */
function toLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function fromLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export async function analyzePDF(file: File): Promise<Diagnostics> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = toLatin1(bytes);
  const notes: string[] = [];

  const headerOffset = text.indexOf('%PDF-');
  const headerFound = headerOffset >= 0;
  const version = headerFound ? (text.slice(headerOffset + 5, headerOffset + 8).match(/^\d\.\d/)?.[0] ?? null) : null;
  const eofFound = text.lastIndexOf('%%EOF') >= 0;
  const startxrefFound = text.lastIndexOf('startxref') >= 0;
  const encrypted = /\/Encrypt\s/.test(text);
  const linearized = /\/Linearized/.test(text);
  const objectsFound = (text.match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
  const catalogFound = /\/Type\s*\/Catalog/.test(text);

  if (!headerFound) notes.push('No %PDF- header — the file may not be a PDF at all.');
  else if (headerOffset > 0) notes.push(`${headerOffset} stray bytes before the %PDF- header.`);
  if (!eofFound) notes.push('Missing %%EOF marker — the file was probably truncated.');
  if (!startxrefFound) notes.push('No startxref pointer — the cross-reference table is unreachable.');
  if (objectsFound === 0) notes.push('No uncompressed objects found; the body may use object streams or be damaged.');
  if (encrypted) notes.push('Document is encrypted.');

  let strictParse = false;
  let pageCount: number | null = null;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
    strictParse = true;
    pageCount = doc.getPageCount();
  } catch (err) {
    notes.push(`Strict parse failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  let lenientParse = false;
  try {
    const pdfjs = await getPDFJS();
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), stopAtErrors: false }).promise;
    lenientParse = true;
    pageCount = pageCount ?? pdf.numPages;
  } catch (err) {
    notes.push(`Lenient parse failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  return {
    size: file.size,
    headerFound,
    headerOffset: Math.max(0, headerOffset),
    version,
    eofFound,
    startxrefFound,
    encrypted,
    linearized,
    objectsFound,
    catalogFound,
    strictParse,
    lenientParse,
    pageCount,
    notes,
  };
}

/**
 * Rebuild the cross-reference table from scratch by scanning the body for
 * `N G obj` markers. This recovers files whose xref offsets are wrong — the
 * single most common form of corruption — without touching the objects.
 */
function rebuildXref(bytes: Uint8Array): Uint8Array | null {
  const text = toLatin1(bytes);
  const headerOffset = text.indexOf('%PDF-');
  if (headerOffset < 0) return null;

  const body = headerOffset > 0 ? text.slice(headerOffset) : text;

  const offsets = new Map<number, { offset: number; gen: number }>();
  const objRe = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = objRe.exec(body)) !== null) {
    const num = parseInt(match[1], 10);
    const gen = parseInt(match[2], 10);
    // Point at the object number, not at the whitespace we matched before it.
    const offset = match.index + match[0].indexOf(match[1]);
    offsets.set(num, { offset, gen });
  }
  if (offsets.size === 0) return null;

  let rootRef: string | null = null;
  const trailerRoot = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(body);
  if (trailerRoot) rootRef = `${trailerRoot[1]} ${trailerRoot[2]} R`;

  if (!rootRef) {
    // Fall back to whichever object declares itself the catalog.
    const catalogRe = /(\d+)\s+(\d+)\s+obj\b[\s\S]{0,4000}?\/Type\s*\/Catalog/g;
    const catalog = catalogRe.exec(body);
    if (catalog) rootRef = `${catalog[1]} ${catalog[2]} R`;
  }
  if (!rootRef) return null;

  const infoMatch = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(body);
  const idMatch = /\/ID\s*\[\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\]/.exec(body);

  const maxObj = Math.max(...offsets.keys());
  const size = maxObj + 1;

  let trimmed = body;
  // Drop anything after the final object so old, broken xref data is not reused.
  const lastEnd = trimmed.lastIndexOf('endobj');
  if (lastEnd > 0) trimmed = trimmed.slice(0, lastEnd + 'endobj'.length);
  trimmed += '\n';

  const xrefOffset = trimmed.length;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) {
    const entry = offsets.get(i);
    xref += entry
      ? `${String(entry.offset).padStart(10, '0')} ${String(entry.gen).padStart(5, '0')} n \n`
      : '0000000000 65535 f \n';
  }

  let trailer = `trailer\n<< /Size ${size} /Root ${rootRef}`;
  if (infoMatch) trailer += ` /Info ${infoMatch[1]} ${infoMatch[2]} R`;
  if (idMatch) trailer += ` /ID [<${idMatch[1]}> <${idMatch[2]}>]`;
  trailer += ` >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return fromLatin1(trimmed + xref + trailer);
}

async function tryLoad(bytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
  } catch {
    return null;
  }
}

async function rasterSalvage(
  bytes: Uint8Array,
  dpi: number,
  onProgress?: ProgressFn
): Promise<{ doc: PDFDocument; pages: number } | null> {
  const pdfjs = await getPDFJS();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: bytes.slice(), stopAtErrors: false }).promise;
  } catch {
    return null;
  }

  const out = await PDFDocument.create();
  const scale = Math.max(0.5, Math.min(4, dpi / 72));
  let recovered = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;

      const image = await out.embedJpg(canvas.toDataURL('image/jpeg', 0.9));
      const w = canvas.width / scale;
      const h = canvas.height / scale;
      const sheet = out.addPage([w, h]);
      sheet.drawImage(image, { x: 0, y: 0, width: w, height: h });
      recovered++;
    } catch {
      // Skip pages that cannot be rendered — recover everything else.
    }
    onProgress?.(Math.round((i / pdf.numPages) * 90));
  }

  if (recovered === 0) return null;
  return { doc: out, pages: recovered };
}

export async function repairPDF(
  file: File,
  options: RepairOptions,
  onProgress?: ProgressFn
): Promise<RepairResult> {
  const diagnostics = await analyzePDF(file);
  const original = new Uint8Array(await file.arrayBuffer());
  const log: string[] = [];
  onProgress?.(10);

  // Step 1 — strip junk before the header and after the last EOF.
  let working = original;
  const text = toLatin1(original);
  const headerOffset = text.indexOf('%PDF-');
  let method: RepairMethod = 'rewrite';

  if (headerOffset > 0) {
    working = original.subarray(headerOffset);
    log.push(`Removed ${headerOffset} bytes of junk before the %PDF- header.`);
    method = 'trim';
  } else if (headerOffset < 0) {
    log.push('No %PDF- header found; attempting structural recovery anyway.');
  }

  // Step 2 — a plain reparse + resave fixes stale xrefs, bad EOFs and generation drift.
  let doc = await tryLoad(working);
  if (doc) {
    log.push('Document parsed; cross-reference table and trailer were rewritten from scratch.');
  } else {
    log.push('Standard parse failed — rebuilding the cross-reference table by scanning for objects.');
    onProgress?.(35);
    const rebuilt = rebuildXref(working);
    if (rebuilt) {
      doc = await tryLoad(rebuilt);
      if (doc) {
        method = 'rebuild-xref';
        log.push(`Rebuilt the xref table from ${diagnostics.objectsFound} recovered objects.`);
      }
    }
  }

  onProgress?.(60);

  if (doc) {
    if (options.removeEncryption && diagnostics.encrypted) {
      log.push('Encryption dictionary dropped — the output opens without a password.');
    }
    doc.setProducer('ConvertTools Repair');
    doc.setModificationDate(new Date());

    try {
      const bytes = await doc.save({ useObjectStreams: false });
      onProgress?.(100);
      return {
        blob: toBlob(bytes),
        name: `${baseName(file)}-repaired.pdf`,
        method,
        log,
        pages: doc.getPageCount(),
        diagnostics,
      };
    } catch (err) {
      log.push(`Rewrite failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // Step 3 — last resort: re-render whatever pdf.js can still draw.
  if (!options.allowRasterSalvage) {
    throw new Error(
      'This file is too damaged to rebuild structurally. Enable page recovery to salvage the readable pages as images.'
    );
  }

  log.push('Structural repair was not possible — recovering readable pages as images.');
  const salvaged = await rasterSalvage(working, options.dpi, (p) => onProgress?.(60 + Math.round(p * 0.35)));
  if (!salvaged) {
    throw new Error('Nothing could be recovered from this file — no readable pages or objects were found.');
  }

  salvaged.doc.setProducer('ConvertTools Repair');
  const bytes = await salvaged.doc.save({ useObjectStreams: true });
  log.push(`Recovered ${salvaged.pages} page${salvaged.pages === 1 ? '' : 's'} as images.`);
  onProgress?.(100);

  return {
    blob: toBlob(bytes),
    name: `${baseName(file)}-recovered.pdf`,
    method: 'rasterize',
    log,
    pages: salvaged.pages,
    diagnostics,
  };
}
