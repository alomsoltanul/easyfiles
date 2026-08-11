import type { ProgressFn, ToolOutput } from './pdf-common';

export interface MarkdownOptions {
  /** Insert `---` between pages. */
  pageBreaks: boolean;
  /** Promote larger / bolder lines to `#` headings. */
  detectHeadings: boolean;
  /** Turn bullet and numbered runs into Markdown lists. */
  detectLists: boolean;
  /** Rebuild column-aligned rows as Markdown tables. */
  detectTables: boolean;
  /** Wrap bold / italic runs in `**` and `*`. */
  detectEmphasis: boolean;
  /** Join wrapped lines back into single paragraphs. */
  mergeParagraphs: boolean;
  /** Pull embedded raster images out into a folder and link them. */
  extractImages: boolean;
}

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = {
  pageBreaks: true,
  detectHeadings: true,
  detectLists: true,
  detectTables: true,
  detectEmphasis: true,
  mergeParagraphs: true,
  extractImages: false,
};

interface Span {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  bold: boolean;
  italic: boolean;
}

interface Line {
  spans: Span[];
  y: number;
  x: number;
  right: number;
  size: number;
  text: string;
  bold: boolean;
}

const BULLET = /^[\u2022\u2023\u25AA\u25E6\u00B7\u2219*+\u2013\u2014-]\s+/;
const ORDERED = /^(\d{1,3}|[a-zA-Z]|[ivxlcdmIVXLCDM]{1,5})[.)]\s+/;

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, '\\$1');
}

/** pdf.js font ids are opaque; resolve them to real base font names when we can. */
async function buildFontMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    await page.getOperatorList();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objs: any = page.commonObjs;
    const raw = objs?._objs ?? {};
    for (const key of Object.keys(raw)) {
      const data = raw[key]?.data ?? raw[key];
      const name: string | undefined = data?.name ?? data?.loadedName;
      if (name) map.set(key, name);
    }
  } catch {
    // Emphasis detection is a bonus — never let it break the conversion.
  }
  return map;
}

function classifyFont(fontName: string): { bold: boolean; italic: boolean } {
  const n = fontName.toLowerCase();
  return {
    bold: /bold|black|heavy|semibold|demibold|[-,_]bd\b/.test(n),
    italic: /italic|oblique|[-,_]it\b/.test(n),
  };
}

function groupIntoLines(spans: Span[]): Line[] {
  const sorted = [...spans].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const span of sorted) {
    const tolerance = Math.max(2, span.size * 0.4);
    const target = lines.find((l) => Math.abs(l.y - span.y) <= tolerance);
    if (target) {
      target.spans.push(span);
      target.y = (target.y * (target.spans.length - 1) + span.y) / target.spans.length;
    } else {
      lines.push({ spans: [span], y: span.y, x: span.x, right: 0, size: span.size, text: '', bold: false });
    }
  }

  for (const line of lines) {
    line.spans.sort((a, b) => a.x - b.x);
    line.x = line.spans[0].x;
    line.right = Math.max(...line.spans.map((s) => s.x + s.width));
    line.size = Math.max(...line.spans.map((s) => s.size));
    const total = line.spans.reduce((n, s) => n + s.text.length, 0);
    const boldChars = line.spans.reduce((n, s) => n + (s.bold ? s.text.length : 0), 0);
    line.bold = total > 0 && boldChars / total > 0.6;
  }

  return lines.sort((a, b) => b.y - a.y);
}

/** Join spans, inserting a space wherever the horizontal gap implies one. */
function lineToText(line: Line, options: MarkdownOptions): string {
  let out = '';
  let prev: Span | null = null;
  let openBold = false;
  let openItalic = false;

  const close = () => {
    if (openItalic) { out += '*'; openItalic = false; }
    if (openBold) { out += '**'; openBold = false; }
  };

  for (const span of line.spans) {
    if (!span.text) continue;
    if (prev) {
      const gap = span.x - (prev.x + prev.width);
      if (gap > span.size * 0.22 && !/\s$/.test(out) && !/^\s/.test(span.text)) out += ' ';
    }
    const body = escapeMarkdown(span.text);
    if (options.detectEmphasis) {
      const wantBold = span.bold && body.trim().length > 0;
      const wantItalic = span.italic && body.trim().length > 0;
      if (openItalic && !wantItalic) { out += '*'; openItalic = false; }
      if (openBold && !wantBold) { out += '**'; openBold = false; }
      if (!openBold && wantBold) { out += '**'; openBold = true; }
      if (!openItalic && wantItalic) { out += '*'; openItalic = true; }
    }
    out += body;
    prev = span;
  }
  close();
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * A run of lines whose spans start at the same x positions is almost always a
 * table. Cluster the column starts and emit a Markdown grid when at least two
 * rows agree on three or more columns.
 */
function detectTableBlock(lines: Line[], start: number): { rows: string[][]; end: number } | null {
  const columnsOf = (line: Line): number[] => {
    const cols: number[] = [];
    let prev: Span | null = null;
    for (const span of line.spans) {
      if (!span.text.trim()) continue;
      if (!prev || span.x - (prev.x + prev.width) > span.size * 1.2) cols.push(span.x);
      prev = span;
    }
    return cols;
  };

  const first = columnsOf(lines[start]);
  if (first.length < 3) return null;

  const matches = (cols: number[]) => {
    if (cols.length < 2) return false;
    let hit = 0;
    for (const c of cols) if (first.some((f) => Math.abs(f - c) < 12)) hit++;
    return hit >= Math.min(3, cols.length);
  };

  let end = start;
  while (end + 1 < lines.length && matches(columnsOf(lines[end + 1]))) end++;
  if (end - start < 1) return null;

  const rows: string[][] = [];
  for (let i = start; i <= end; i++) {
    const cells: string[] = new Array(first.length).fill('');
    let prev: Span | null = null;
    let col = 0;
    for (const span of lines[i].spans) {
      if (!span.text.trim()) continue;
      if (!prev || span.x - (prev.x + prev.width) > span.size * 1.2) {
        let best = 0;
        let bestDist = Infinity;
        first.forEach((f, n) => {
          const d = Math.abs(f - span.x);
          if (d < bestDist) { bestDist = d; best = n; }
        });
        col = best;
      }
      cells[col] = (cells[col] ? cells[col] + ' ' : '') + escapeMarkdown(span.text.trim());
      prev = span;
    }
    rows.push(cells.map((c) => c.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()));
  }

  return { rows, end };
}

function headingLevel(line: Line, bodySize: number, text: string): number {
  const ratio = line.size / bodySize;
  if (ratio >= 1.75) return 1;
  if (ratio >= 1.45) return 2;
  if (ratio >= 1.22) return 3;
  if (ratio >= 1.08) return 4;
  // Same size, but bold, short, and not a sentence — a run-in heading.
  if (line.bold && text.length <= 90 && !/[.;:,]$/.test(text)) return 4;
  return 0;
}

export interface MarkdownResult extends ToolOutput {
  markdown: string;
  pages: number;
  words: number;
  images: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function imageToPng(img: any): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (img?.bitmap) {
      canvas.width = img.bitmap.width;
      canvas.height = img.bitmap.height;
      ctx.drawImage(img.bitmap, 0, 0);
    } else if (img?.data && img?.width && img?.height) {
      canvas.width = img.width;
      canvas.height = img.height;
      const out = ctx.createImageData(img.width, img.height);
      const src = img.data as Uint8ClampedArray;
      const pixels = img.width * img.height;
      if (src.length >= pixels * 4) {
        out.data.set(src.subarray(0, pixels * 4));
      } else if (src.length >= pixels * 3) {
        for (let i = 0, j = 0; i < pixels; i++, j += 3) {
          out.data[i * 4] = src[j];
          out.data[i * 4 + 1] = src[j + 1];
          out.data[i * 4 + 2] = src[j + 2];
          out.data[i * 4 + 3] = 255;
        }
      } else {
        return null;
      }
      ctx.putImageData(out, 0, 0);
    } else {
      return null;
    }

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

export async function pdfToMarkdown(
  file: File,
  options: MarkdownOptions,
  onProgress?: ProgressFn
): Promise<MarkdownResult> {
  const pdfjs = await import('pdfjs-dist');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const base = file.name.replace(/\.[^.]+$/, '');

  const pageBlocks: string[] = [];
  const images: { name: string; blob: Blob }[] = [];
  let words = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const fontMap = options.detectEmphasis ? await buildFontMap(page) : new Map<string, string>();
    const content = await page.getTextContent();

    const spans: Span[] = [];
    for (const raw of content.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = raw as any;
      if (typeof item.str !== 'string' || item.str === '') continue;
      const t = item.transform as number[];
      const size = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 10;
      const resolved = fontMap.get(item.fontName) ?? item.fontName ?? '';
      const { bold, italic } = classifyFont(resolved);
      spans.push({ text: item.str, x: t[4], y: t[5], width: item.width ?? 0, size, bold, italic });
    }

    const pageImages: string[] = [];
    if (options.extractImages) {
      try {
        const ops = await page.getOperatorList();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OPS = (pdfjs as any).OPS;
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
          const name = ops.argsArray[i][0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const store: any = name?.startsWith?.('g_') ? page.commonObjs : page.objs;
          if (!store?.has?.(name)) continue;
          const blob = await imageToPng(store.get(name));
          if (blob) {
            const imageName = `images/page-${p}-${pageImages.length + 1}.png`;
            images.push({ name: imageName, blob });
            pageImages.push(imageName);
          }
        }
      } catch {
        // Images are optional; text conversion continues either way.
      }
    }

    const lines = groupIntoLines(spans);
    const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
    const bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 12;
    const maxRight = lines.length ? Math.max(...lines.map((l) => l.right)) : 0;

    const out: string[] = [];
    let paragraph = '';

    const flush = () => {
      if (paragraph.trim()) out.push(paragraph.trim());
      paragraph = '';
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (options.detectTables) {
        const table = detectTableBlock(lines, i);
        if (table) {
          flush();
          const width = table.rows[0].length;
          out.push(`| ${table.rows[0].join(' | ')} |`);
          out.push(`|${' --- |'.repeat(width)}`);
          for (const row of table.rows.slice(1)) out.push(`| ${row.join(' | ')} |`);
          i = table.end;
          continue;
        }
      }

      const text = lineToText(line, options);
      if (!text) { flush(); continue; }
      words += text.split(/\s+/).filter(Boolean).length;

      if (options.detectLists) {
        const bullet = text.match(BULLET);
        if (bullet) {
          flush();
          out.push(`- ${text.slice(bullet[0].length)}`);
          continue;
        }
        const ordered = text.match(ORDERED);
        if (ordered && /^\d/.test(text)) {
          flush();
          out.push(`${ordered[1]}. ${text.slice(ordered[0].length)}`);
          continue;
        }
      }

      if (options.detectHeadings) {
        const level = headingLevel(line, bodySize, text);
        if (level > 0) {
          flush();
          out.push(`${'#'.repeat(level)} ${text.replace(/\\([*_`])/g, '$1')}`);
          continue;
        }
      }

      if (!options.mergeParagraphs) {
        out.push(text);
        continue;
      }

      // Wrapped line: the previous line ran to the right margin and did not end
      // a sentence, so glue them together instead of starting a new paragraph.
      const prev = lines[i - 1];
      const wrapped =
        paragraph &&
        prev &&
        prev.right > maxRight - prev.size * 3 &&
        !/[.!?:;]["')\]]?$/.test(paragraph);

      if (wrapped) {
        paragraph = paragraph.replace(/-$/, '') + (paragraph.endsWith('-') ? '' : ' ') + text;
      } else {
        flush();
        paragraph = text;
      }
    }
    flush();

    pageImages.forEach((src, n) => out.push(`![Page ${p} image ${n + 1}](${src})`));

    pageBlocks.push(out.join('\n\n'));
    onProgress?.(Math.round((p / pdf.numPages) * 95));
  }

  const body = options.pageBreaks
    ? pageBlocks.map((b, i) => (i === 0 ? b : `\n---\n\n${b}`)).join('\n\n')
    : pageBlocks.join('\n\n');

  const markdown = `${body.replace(/\n{3,}/g, '\n\n').trim()}\n`;
  onProgress?.(100);

  let blob: Blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  let name = `${base}.md`;

  if (images.length > 0) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(`${base}.md`, markdown);
    for (const img of images) zip.file(img.name, img.blob);
    blob = await zip.generateAsync({ type: 'blob' });
    name = `${base}-markdown.zip`;
  }

  return { blob, name, markdown, pages: pdf.numPages, words, images: images.length };
}
