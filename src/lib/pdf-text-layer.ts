import { pdfPointToVisual, type PdfRect } from './pdf-common';
import type { RunAnchor } from './pdf-text-remove';
import {
  getTextMetrics,
  nearestStandardFont,
  unsupportedGlyphs,
  wrapText,
  type AnnotationFontKey,
  type TextAlign,
  type TextMetrics,
  type WrappedLine,
} from './pdf-text-metrics';

/**
 * Reads the text off a PDF page and rebuilds it as editable blocks.
 *
 * A PDF has no paragraphs — only glyphs at coordinates. To let someone retype a
 * sentence we have to invent the structure back: glyphs become spans, spans
 * become lines, lines are cut into columns, and each column is split into
 * paragraphs and table rows. Every block records the exact rectangle its
 * original glyphs occupied so the writer can paint over them, and the box the
 * replacement text should be laid into so it re-wraps like a text editor.
 *
 * All geometry here is unrotated PDF user space (y up). The editor converts to
 * screen coordinates for display; the writer draws in it directly.
 */

/** Fraction of the font size sitting above the baseline. Fixed so that
 *  `boxTop - ascent` always reproduces the original baseline exactly. */
export const ASCENT_RATIO = 0.8;

export interface TextBlock {
  id: string;
  /** 0-based page index */
  page: number;
  /** Glyph rectangle to paint over, PDF user space, `y` is the bottom edge. */
  cover: PdfRect;
  /** Left edge of the text measure, PDF user space. */
  x: number;
  /** Top edge of the text box (first baseline + ascent), PDF user space. */
  top: number;
  /** The measure new text wraps at, in points. */
  width: number;
  /** Original text, one `\n` per hard line break. */
  text: string;
  size: number;
  font: AnnotationFontKey;
  color: string;
  /** Colour sampled from behind the glyphs, used to erase them. */
  background: string;
  /** Baseline-to-baseline distance, in points. */
  lineHeight: number;
  align: TextAlign;
  /** How many lines the block occupied in the original file. */
  lines: number;
  /**
   * How many lines the *original* text wraps to using our own metrics. Edits
   * are measured against this, not against `lines` — the standard fonts we
   * draw with never match the document's embedded ones exactly, so an untouched
   * block has to come out at zero delta or the whole page would drift.
   */
  naturalLines: number;
  /** Blocks sharing a flow push each other up and down when they resize. */
  flowId: string;
  /** Position in the flow. Table cells on one row share a row number. */
  row: number;
  /** True for a table cell — the editor labels and reflows those as a grid. */
  cell: boolean;
  /**
   * Where each original glyph run starts, relative to the crop box. The writer
   * uses these to find those runs in the content stream and delete them, so a
   * rewritten sentence really leaves the file instead of hiding under a patch.
   */
  glyphs: RunAnchor[];
}

/* ------------------------------------------------------------------ */
/* pdf.js access                                                       */
/* ------------------------------------------------------------------ */

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

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let docCache: { key: string; doc: Promise<any> } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function documentFor(file: File): Promise<any> {
  const key = fileKey(file);
  if (docCache?.key !== key) {
    const load = (async () => {
      const pdfjs = await getPDFJS();
      return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    })();
    docCache = { key, doc: load };
  }
  return docCache.doc;
}

export function forgetTextLayerCache() {
  docCache = null;
}

/** pdf.js hands back opaque font ids; resolve them to real base font names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildFontMap(page: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    await page.getOperatorList();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = page.commonObjs?._objs ?? {};
    for (const key of Object.keys(raw)) {
      const data = raw[key]?.data ?? raw[key];
      const name: string | undefined = data?.name ?? data?.loadedName;
      if (name) map.set(key, name);
    }
  } catch {
    // Font naming is a nicety — never let it block extraction.
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Colour sampling                                                     */
/* ------------------------------------------------------------------ */

interface Sample {
  background: string;
  color: string | null;
  /**
   * How far the ink actually reaches inside the probed rect, as a fraction of
   * its height measured from the bottom. A run of Japanese or a word with a
   * descender fills far more of its line box than a row of lowercase Latin, and
   * guessing from the font size alone leaves a sliver of the old text showing
   * above or below the patch.
   */
  ink: { bottom: number; top: number } | null;
}

interface Sampler {
  /** Sample a PDF-space rect: the paper behind it, the ink on it, its extent. */
  at: (rect: PdfRect) => Sample;
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function makeSampler(
  image: ImageData,
  pageWidth: number,
  pageHeight: number,
  rotation: number
): Sampler {
  const { data, width: iw, height: ih } = image;

  return {
    at(rect: PdfRect) {
      // The rect's PDF corners map to two opposite corners on screen.
      const a = pdfPointToVisual(rect.x, rect.y, pageWidth, pageHeight, rotation);
      const b = pdfPointToVisual(rect.x + rect.width, rect.y + rect.height, pageWidth, pageHeight, rotation);
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) * iw));
      const x1 = Math.min(iw, Math.ceil(Math.max(a.x, b.x) * iw));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) * ih));
      const y1 = Math.min(ih, Math.ceil(Math.max(a.y, b.y) * ih));
      if (x1 - x0 < 1 || y1 - y0 < 1) return { background: '#ffffff', color: null, ink: null };

      // Bucket by the top 4 bits per channel, then average the winning bucket
      // back to a real colour so gradients do not snap to a flat step.
      const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
      const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 20000)));
      let total = 0;

      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * iw + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const bucket = counts.get(key);
          if (bucket) { bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b; }
          else counts.set(key, { n: 1, r, g, b });
          total++;
        }
      }
      if (total === 0) return { background: '#ffffff', color: null, ink: null };

      let paper = { n: 0, r: 255, g: 255, b: 255 };
      for (const bucket of counts.values()) if (bucket.n > paper.n) paper = bucket;
      const bg = { r: paper.r / paper.n, g: paper.g / paper.n, b: paper.b / paper.n };

      // Ink is whatever sits furthest from the paper colour and still covers a
      // believable share of the rect.
      let ink: { n: number; r: number; g: number; b: number } | null = null;
      let inked = 0;
      for (const bucket of counts.values()) {
        const dr = bucket.r / bucket.n - bg.r;
        const dg = bucket.g / bucket.n - bg.g;
        const db = bucket.b / bucket.n - bg.b;
        if (Math.hypot(dr, dg, db) < 70) continue;
        inked += bucket.n;
        if (!ink || bucket.n > ink.n) ink = bucket;
      }

      // Walk the probe one scanline at a time, along whichever image axis the
      // page's rotation maps PDF-y onto, and note where ink first and last
      // appears. Rows are cheap: one pass, full resolution, no sampling step.
      const r = ((rotation % 360) + 360) % 360;
      const acrossX = r === 90 || r === 270;
      const flipped = r === 0 || r === 270;
      const lines = acrossX ? x1 - x0 : y1 - y0;
      let first = -1;
      let last = -1;

      for (let n = 0; n < lines; n++) {
        let hit = false;
        if (acrossX) {
          const x = x0 + n;
          for (let y = y0; y < y1 && !hit; y++) {
            const i = (y * iw + x) * 4;
            hit = Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b) >= 60;
          }
        } else {
          const y = y0 + n;
          const row = y * iw;
          for (let x = x0; x < x1 && !hit; x++) {
            const i = (row + x) * 4;
            hit = Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b) >= 60;
          }
        }
        if (hit) { if (first < 0) first = n; last = n; }
      }

      // Scanline n runs from low to high on the image axis; PDF-y runs the other
      // way at 0° and 270°, so the ends swap there.
      const extent = first < 0 ? null : flipped
        ? { bottom: 1 - (last + 1) / lines, top: 1 - first / lines }
        : { bottom: first / lines, top: (last + 1) / lines };

      return {
        background: hex(bg.r, bg.g, bg.b),
        color: ink && inked / total > 0.02 ? hex(ink.r / ink.n, ink.g / ink.n, ink.b / ink.n) : null,
        ink: extent,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Spans and lines                                                     */
/* ------------------------------------------------------------------ */

interface Span {
  text: string;
  x: number;
  /** Baseline, PDF user space. */
  y: number;
  width: number;
  size: number;
  font: AnnotationFontKey;
}

interface Line {
  spans: Span[];
  y: number;
  x: number;
  right: number;
  size: number;
  text: string;
}

function toLines(spans: Span[]): Line[] {
  const sorted = [...spans].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const span of sorted) {
    const tolerance = Math.max(1.5, span.size * 0.35);
    const target = lines.find((line) => Math.abs(line.y - span.y) <= tolerance);
    if (target) target.spans.push(span);
    else lines.push({ spans: [span], y: span.y, x: 0, right: 0, size: 0, text: '' });
  }

  for (const line of lines) {
    line.spans.sort((a, b) => a.x - b.x);
    line.x = line.spans[0].x;
    line.right = Math.max(...line.spans.map((s) => s.x + s.width));
    line.size = Math.max(...line.spans.map((s) => s.size));
    line.y = line.spans.reduce((sum, s) => sum + s.y, 0) / line.spans.length;
    line.text = joinSpans(line.spans);
  }

  return lines.filter((line) => line.text.trim().length > 0).sort((a, b) => b.y - a.y);
}

/** Glue spans back together, restoring the spaces the encoder dropped. */
function joinSpans(spans: Span[]): string {
  let out = '';
  let prev: Span | null = null;
  for (const span of spans) {
    if (prev) {
      const gap = span.x - (prev.x + prev.width);
      if (gap > span.size * 0.18 && !/\s$/.test(out) && !/^\s/.test(span.text)) out += ' ';
    }
    out += span.text;
    prev = span;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Split a line where the horizontal gaps are wide enough to be a table gutter. */
function cellsOf(line: Line): { x: number; right: number; spans: Span[] }[] {
  const cells: { x: number; right: number; spans: Span[] }[] = [];
  let prev: Span | null = null;

  for (const span of line.spans) {
    if (!span.text.trim()) continue;
    const gap = prev ? span.x - (prev.x + prev.width) : Infinity;
    if (!prev || gap > span.size * 1.6) {
      cells.push({ x: span.x, right: span.x + span.width, spans: [span] });
    } else {
      const cell = cells[cells.length - 1];
      cell.spans.push(span);
      cell.right = span.x + span.width;
    }
    prev = span;
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Column bands                                                        */
/* ------------------------------------------------------------------ */

interface Band { left: number; right: number }

/** A column of the page, and the lines that live in it. */
interface Column { band: Band; lines: Line[] }

/**
 * Cut the page into columns, then group each column's glyphs into lines.
 *
 * Order matters. Two columns of prose usually share their baselines, so
 * grouping into lines first would weld each pair of facing lines into one
 * 448-point line and erase the gutter. Gutters are therefore found from the
 * raw text runs, and only then is each column's text read line by line.
 */
function splitColumns(spans: Span[]): { columns: Column[]; wide: Line[] } {
  const single = (): { columns: Column[]; wide: Line[] } => {
    const lines = toLines(spans);
    if (lines.length === 0) return { columns: [], wide: [] };
    return {
      columns: [{
        band: { left: Math.min(...lines.map((l) => l.x)), right: Math.max(...lines.map((l) => l.right)) },
        lines,
      }],
      wide: [],
    };
  };

  if (spans.length < 8) return single();

  const left = Math.min(...spans.map((s) => s.x));
  const right = Math.max(...spans.map((s) => s.x + s.width));
  const span = right - left;
  if (span <= 0) return single();

  // A gutter is a vertical strip almost no text run crosses. "Almost" matters:
  // a headline or a footer running the full width crosses every gutter, and
  // demanding a completely empty strip would hide the columns beneath it.
  const bin = 2;
  const slots = Math.ceil(span / bin) + 1;
  const crossings = new Int32Array(slots);
  for (const run of spans) {
    const from = Math.max(0, Math.floor((run.x - left) / bin));
    const to = Math.min(slots - 1, Math.ceil((run.x + run.width - left) / bin));
    for (let i = from; i <= to; i++) crossings[i]++;
  }

  const tolerated = Math.max(1, Math.floor(spans.length * 0.08));
  const minGutter = Math.max(14, span * 0.03);
  const cuts: number[] = [];
  let runStart = -1;

  for (let i = 0; i <= slots; i++) {
    const free = i < slots && crossings[i] <= tolerated;
    if (free && runStart < 0) runStart = i;
    if (!free && runStart >= 0) {
      const from = left + runStart * bin;
      const to = left + i * bin;
      // Interior gutters only — page margins are not column breaks.
      if (to - from >= minGutter && from > left + span * 0.1 && to < right - span * 0.1) {
        cuts.push((from + to) / 2);
      }
      runStart = -1;
    }
  }
  if (cuts.length === 0 || cuts.length > 3) return single();

  const bands: Band[] = [];
  let edge = left;
  for (const cut of cuts) { bands.push({ left: edge, right: cut }); edge = cut; }
  bands.push({ left: edge, right });

  const perBand: Span[][] = bands.map(() => []);
  const straddling: Span[] = [];
  for (const run of spans) {
    const index = bands.findIndex((b) => run.x >= b.left - 1 && run.x + run.width <= b.right + 1);
    if (index < 0) straddling.push(run);
    else perBand[index].push(run);
  }

  const columns: Column[] = bands.map((band, index) => ({ band, lines: toLines(perBand[index]) }));

  // The same gaps show up between the columns of a table, where they are not
  // gutters at all. Two things separate the cases: prose fills most of its
  // measure, and prose lines are one continuous run rather than several cells
  // with wide gaps between them. Tables fall through to row detection instead.
  const filled = columns.every((column) => {
    if (column.lines.length < 2) return false;
    const width = column.band.right - column.band.left;
    if (width <= 0) return false;
    return median(column.lines.map((line) => (line.right - line.x) / width)) >= 0.6;
  });

  const all = columns.flatMap((column) => column.lines);
  const gridded = all.filter((line) => cellsOf(line).length > 1).length;
  if (!filled || gridded >= all.length * 0.5) return single();

  return { columns, wide: toLines(straddling) };
}

/* ------------------------------------------------------------------ */
/* Paragraph and table grouping                                        */
/* ------------------------------------------------------------------ */

const BULLET = /^[•‣▪◦·∙*+–—-]\s+/;
const ORDERED = /^(\d{1,3}|[a-zA-Z]|[ivxlcdmIVXLCDM]{1,5})[.)]\s+/;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Where a line has to fall short of the measure before it counts as the end of
 * a paragraph. Justified text ends every line on the same edge, so a couple of
 * ems is plenty; ragged-right text wanders by a word or more, and holding it to
 * the same standard would break a paragraph at every line.
 */
function shortLineEdge(lines: Line[]): number {
  const rights = lines.map((line) => line.right);
  const measure = Math.max(...rights);
  const ragged = measure - median(rights);
  const size = median(lines.map((line) => line.size)) || 11;
  return measure - Math.max(size * 2.5, ragged * 1.8);
}

/** True when `line` starts a new paragraph rather than continuing `prev`. */
function breaksParagraph(prev: Line, line: Line, gapMedian: number, shortEdge: number): boolean {
  const gap = prev.y - line.y;
  if (gap > gapMedian * 1.7) return true;
  if (Math.abs(prev.size - line.size) > Math.max(prev.size, line.size) * 0.12) return true;
  if (BULLET.test(line.text) || (ORDERED.test(line.text) && /^\d/.test(line.text))) return true;
  // The previous line stopped well short of the measure — it ended something.
  if (prev.right < shortEdge) return true;
  // A first-line indent.
  if (line.x > prev.x + line.size * 0.7) return true;
  return false;
}

/**
 * A run of lines that all break into the same column positions is a table.
 * Returns the rows as cell groups so each cell can be edited on its own.
 */
function findTableRun(lines: Line[], start: number): { rows: { x: number; right: number; spans: Span[] }[][]; end: number } | null {
  const first = cellsOf(lines[start]);
  if (first.length < 2) return null;

  const anchors = first.map((cell) => cell.x);
  const agrees = (cells: { x: number }[]) => {
    if (cells.length < 2) return false;
    // Wide word spacing in justified prose can look like two cells, so demand a
    // real grid: a matching left edge and at least two columns landing on the
    // same anchors as the first row.
    if (Math.abs(cells[0].x - anchors[0]) > 6) return false;
    if (Math.abs(cells.length - first.length) > 1) return false;
    const hits = cells.filter((cell) => anchors.some((a) => Math.abs(a - cell.x) < 6)).length;
    return hits >= 2;
  };

  const rows = [first];
  let end = start;
  while (end + 1 < lines.length) {
    const gap = lines[end].y - lines[end + 1].y;
    if (gap > Math.max(lines[end].size, lines[end + 1].size) * 3) break;
    const next = cellsOf(lines[end + 1]);
    if (!agrees(next)) break;
    for (const cell of next) if (!anchors.some((a) => Math.abs(a - cell.x) < 8)) anchors.push(cell.x);
    rows.push(next);
    end++;
  }

  // Two aligned rows is the minimum that proves a grid rather than a coincidence.
  return rows.length >= 2 ? { rows, end } : null;
}

/** Work out how a paragraph's lines were aligned inside their column. */
function detectAlign(lines: Line[], band: Band): TextAlign {
  const bandWidth = band.right - band.left;
  if (bandWidth <= 0) return 'left';
  const lefts = lines.map((l) => l.x);
  const rights = lines.map((l) => l.right);
  const near = (values: number[], tolerance: number) => Math.max(...values) - Math.min(...values) <= tolerance;

  if (lines.length === 1) {
    const line = lines[0];
    const leftPad = line.x - band.left;
    const rightPad = band.right - line.right;
    if (leftPad > bandWidth * 0.06 && Math.abs(leftPad - rightPad) < Math.max(4, bandWidth * 0.03)) return 'center';
    if (leftPad > bandWidth * 0.12 && rightPad < Math.max(3, bandWidth * 0.02)) return 'right';
    return 'left';
  }

  const body = lines.slice(0, -1);
  if (near(lefts, 2.5) && near(body.map((l) => l.right), 3) && band.right - median(body.map((l) => l.right)) < lines[0].size * 1.2) {
    return 'justify';
  }
  if (near(lines.map((l) => (l.x + l.right) / 2), 4) && !near(lefts, 3)) return 'center';
  if (near(rights, 2.5) && !near(lefts, 3)) return 'right';
  return 'left';
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

let blockSeq = 0;

interface BuildInput {
  lines: Line[];
  band: Band;
  flowId: string;
  page: number;
  sampler: Sampler | null;
  cell: boolean;
  /** Force the measure instead of deriving it from the band. */
  measure?: { x: number; width: number };
  /**
   * Right edge of the space the column could grow into. A single line has
   * demonstrably free room beside it, so it may use this; a wrapped paragraph
   * must keep the measure it was set at or it would re-wrap wider than its
   * neighbours.
   */
  outerRight: number;
  row: number;
}

function buildBlock({ lines, band, flowId, page, sampler, cell, measure, outerRight, row }: BuildInput): TextBlock | null {
  const text = lines.map((line) => line.text).join('\n').trim();
  if (!text) return null;

  const size = median(lines.map((l) => l.size)) || lines[0].size || 11;
  const font = lines[0].spans[0]?.font ?? 'Helvetica';
  const align = cell ? 'left' : detectAlign(lines, band);

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
  const lineHeight = gaps.length ? median(gaps) : size * 1.16;

  const left = Math.min(...lines.map((l) => l.x));
  const right = Math.max(...lines.map((l) => l.right));
  const top = lines[0].y + size * ASCENT_RATIO;

  // Probe well past where Latin text would reach, so tall scripts and deep
  // descenders are inside the sampled area, then trim back to the ink we find.
  const pad = 0.75;
  const probeTop = lines[0].y + size * 1.02;
  const probeBottom = lines[lines.length - 1].y - size * 0.38;
  const probe: PdfRect = {
    x: left - pad,
    y: probeBottom - pad,
    width: right - left + pad * 2,
    height: probeTop - probeBottom + pad * 2,
  };

  const sampled = sampler?.at(probe);
  const cover: PdfRect = sampled?.ink
    ? {
        x: probe.x,
        y: probe.y + sampled.ink.bottom * probe.height - pad,
        width: probe.width,
        height: (sampled.ink.top - sampled.ink.bottom) * probe.height + pad * 2,
      }
    : probe;

  // Centred and right-aligned text needs the whole column as its measure,
  // otherwise it would re-centre inside its own ink.
  const flush = align === 'left' || align === 'justify';
  const measureX = measure ? measure.x : flush ? left : band.left;
  const measureWidth = measure
    ? measure.width
    : flush
      ? Math.max(right, lines.length > 1 ? band.right : outerRight) - measureX
      : band.right - band.left;

  return {
    id: `tb-${++blockSeq}`,
    page,
    cover,
    x: measureX,
    top,
    width: Math.max(size, measureWidth),
    text,
    size: Math.round(size * 100) / 100,
    font,
    color: sampled?.color ?? '#1a1a1a',
    background: sampled?.background ?? '#ffffff',
    lineHeight: Math.round(Math.max(size, lineHeight) * 100) / 100,
    align,
    lines: lines.length,
    naturalLines: lines.length,
    flowId,
    row,
    cell,
    glyphs: lines.flatMap((line) => line.spans.map((span) => ({ x: span.x, y: span.y }))),
  };
}

export interface PageTextLayer {
  blocks: TextBlock[];
  /** True when the page carries no extractable text — a scan, most likely. */
  scanned: boolean;
}

/**
 * Pull one page apart into editable blocks. `sample` renders the page so text
 * and paper colours can be measured; turn it off for a faster, greyscale-blind
 * pass.
 */
export async function extractPageTextLayer(
  file: File,
  pageIndex: number,
  options: { sample?: boolean } = {}
): Promise<PageTextLayer> {
  const doc = await documentFor(file);
  const page = await doc.getPage(pageIndex + 1);

  const view = page.view as number[];
  const originX = view[0];
  const originY = view[1];
  const pageWidth = view[2] - view[0];
  const pageHeight = view[3] - view[1];
  const rotation = ((page.rotate ?? 0) % 360 + 360) % 360;

  const fontMap = await buildFontMap(page);
  const content = await page.getTextContent();
  // pdf.js always classifies each font as serif / sans-serif / monospace, even
  // when the real base name is unavailable — a reliable floor for font guessing.
  const styles: Record<string, { fontFamily?: string }> = content.styles ?? {};

  const spans: Span[] = [];
  for (const raw of content.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = raw as any;
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const t = item.transform as number[];
    // Only upright, unskewed runs can be re-typeset safely; leave the rest be.
    if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01 || t[0] <= 0 || t[3] <= 0) continue;
    const size = t[3] || Math.hypot(t[2], t[3]) || 10;
    spans.push({
      text: item.str,
      x: t[4] - originX,
      y: t[5] - originY,
      width: item.width ?? size * 0.5 * item.str.length,
      size,
      font: nearestStandardFont(
        fontMap.get(item.fontName) ?? item.fontName ?? '',
        styles[item.fontName]?.fontFamily
      ),
    });
  }

  if (spans.length === 0) return { blocks: [], scanned: true };

  let sampler: Sampler | null = null;
  if (options.sample !== false) {
    try {
      const scale = Math.min(2, Math.max(1, 900 / Math.max(pageWidth, pageHeight)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
        sampler = makeSampler(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          pageWidth,
          pageHeight,
          rotation
        );
      }
    } catch {
      // Colour sampling is an enhancement; black on white is a fine fallback.
    }
  }

  const { columns, wide } = splitColumns(spans);
  if (columns.length === 0) return { blocks: [], scanned: true };

  const blocks: TextBlock[] = [];

  const runBand = (bandLines: Line[], outer: Band, flowId: string) => {
    if (bandLines.length === 0) return;
    const sorted = [...bandLines].sort((a, b) => b.y - a.y);
    // Paragraph breaks and alignment are judged against the measure the column
    // actually uses, not the gutter midpoint the band was cut at.
    const band: Band = {
      left: Math.min(...sorted.map((l) => l.x)),
      right: Math.max(...sorted.map((l) => l.right)),
    };
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i - 1].y - sorted[i].y;
      if (gap > 0 && gap < sorted[i].size * 3) gaps.push(gap);
    }
    const gapMedian = median(gaps) || sorted[0].size * 1.16;
    const shortEdge = shortLineEdge(sorted);

    let row = 0;
    let lastBottom = Infinity;

    /** Reuse the current row when the new block sits beside it, not below it. */
    const rowFor = (topY: number, bottomY: number) => {
      if (topY > lastBottom + 0.5) {
        lastBottom = Math.min(lastBottom, bottomY);
        return row;
      }
      lastBottom = bottomY;
      return ++row;
    };

    for (let i = 0; i < sorted.length; i++) {
      const table = findTableRun(sorted, i);
      if (table) {
        // Column edges are shared by the whole table so cells can grow into
        // their own measure without colliding with the next column.
        const anchors = [...new Set(table.rows.flatMap((cells) => cells.map((c) => Math.round(c.x))))].sort((a, b) => a - b);
        const merged: number[] = [];
        for (const anchor of anchors) {
          if (merged.length === 0 || anchor - merged[merged.length - 1] > 8) merged.push(anchor);
        }
        const edgeFor = (x: number) => {
          let best = 0;
          for (let c = 0; c < merged.length; c++) if (Math.abs(merged[c] - x) < Math.abs(merged[best] - x)) best = c;
          return best;
        };

        table.rows.forEach((cells, r) => {
          const rowIndex = row + 1 + r;
          for (const cell of cells) {
            const column = edgeFor(cell.x);
            const nextEdge = merged[column + 1];
            const measureRight = nextEdge !== undefined ? nextEdge - 4 : outer.right;
            const line: Line = {
              spans: cell.spans,
              y: cell.spans[0].y,
              x: cell.x,
              right: cell.right,
              size: Math.max(...cell.spans.map((s) => s.size)),
              text: joinSpans(cell.spans),
            };
            const block = buildBlock({
              lines: [line],
              band,
              flowId,
              page: pageIndex,
              sampler,
              cell: true,
              measure: { x: cell.x, width: Math.max(cell.right - cell.x, measureRight - cell.x) },
              outerRight: outer.right,
              row: rowIndex,
            });
            if (block) blocks.push(block);
          }
        });

        row += table.rows.length;
        lastBottom = sorted[table.end].y;
        i = table.end;
        continue;
      }

      const group: Line[] = [sorted[i]];
      while (
        i + 1 < sorted.length &&
        !findTableRun(sorted, i + 1) &&
        !breaksParagraph(sorted[i], sorted[i + 1], gapMedian, shortEdge)
      ) {
        group.push(sorted[++i]);
      }

      const topY = group[0].y + group[0].size * ASCENT_RATIO;
      const bottomY = group[group.length - 1].y - group[group.length - 1].size * 0.26;
      const block = buildBlock({
        lines: group,
        band,
        flowId,
        page: pageIndex,
        sampler,
        cell: false,
        outerRight: outer.right,
        row: rowFor(topY, bottomY),
      });
      if (block) blocks.push(block);
    }
  };

  columns.forEach((column, index) => runBand(column.lines, column.band, `p${pageIndex}-c${index}`));
  if (wide.length > 0) {
    runBand(wide, {
      left: Math.min(...columns.map((c) => c.band.left)),
      right: Math.max(...columns.map((c) => c.band.right)),
    }, `p${pageIndex}-w`);
  }

  const metrics = await getTextMetrics();
  for (const block of blocks) {
    block.naturalLines = Math.max(1, wrapText(block.text, block.font, block.size, block.width, metrics).length);
  }

  return { blocks: blocks.sort((a, b) => b.top - a.top || a.x - b.x), scanned: false };
}

/* ------------------------------------------------------------------ */
/* Reflow                                                              */
/* ------------------------------------------------------------------ */

/**
 * Push every block in a flow up or down by however much the blocks above it
 * grew or shrank. Table rows move as a unit — the tallest cell sets the row.
 *
 * Returns the vertical offset per block, in points (positive = moved down).
 */
export function computeFlowShifts(
  blocks: TextBlock[],
  heightOf: (block: TextBlock) => number,
  /**
   * Blocks that must not move. Text we cannot redraw — Japanese, Greek, any
   * script outside the standard fonts — has to stay exactly where the document
   * put it, because moving it means redrawing it and redrawing it would destroy
   * it. The flow stops at the first such block rather than damaging it.
   */
  immovable?: (block: TextBlock) => boolean
): Map<string, number> {
  const shifts = new Map<string, number>();
  const flows = new Map<string, TextBlock[]>();
  for (const block of blocks) {
    const list = flows.get(block.flowId);
    if (list) list.push(block);
    else flows.set(block.flowId, [block]);
  }

  for (const list of flows.values()) {
    const rows = new Map<number, TextBlock[]>();
    for (const block of list) {
      const group = rows.get(block.row);
      if (group) group.push(block);
      else rows.set(block.row, [block]);
    }

    let shift = 0;
    for (const row of [...rows.keys()].sort((a, b) => a - b)) {
      const group = rows.get(row)!;
      if (immovable && group.some(immovable)) break;
      for (const block of group) shifts.set(block.id, shift);
      let delta = -Infinity;
      for (const block of group) {
        delta = Math.max(delta, heightOf(block) - block.naturalLines * block.lineHeight);
      }
      if (!Number.isFinite(delta)) delta = 0;
      shift -= delta; // PDF y grows upward, so growing text moves the rest down.
    }
  }

  return shifts;
}

/* ------------------------------------------------------------------ */
/* Live layout                                                         */
/* ------------------------------------------------------------------ */

/** What the user changed about a block. Absent keys keep the original. */
export interface BlockEdit {
  text?: string;
  removed?: boolean;
  size?: number;
  font?: AnnotationFontKey;
  color?: string;
  align?: TextAlign;
  lineHeight?: number;
  background?: string;
}

export interface LiveBlock {
  block: TextBlock;
  text: string;
  removed: boolean;
  size: number;
  font: AnnotationFontKey;
  color: string;
  align: TextAlign;
  lineHeight: number;
  background: string;
  lines: WrappedLine[];
  /** Height of the re-wrapped text, in points. */
  height: number;
  /** Points to add to `block.top`. Negative moves the block down the page. */
  shift: number;
  changed: boolean;
  /** Managed blocks get erased and redrawn; the rest keep their original ink. */
  managed: boolean;
  /** Characters here that the standard PDF fonts cannot draw. */
  missing: string[];
  /**
   * True when this block stopped its column from flowing. The editor tells the
   * user, because content above it can now run into it.
   */
  wall: boolean;
}

/**
 * Re-wrap every block on a page and work out where each one ends up once the
 * ones above it have grown or shrunk. This runs on every keystroke, so the
 * document visibly flows while you type.
 */
export function layoutBlocks(
  blocks: TextBlock[],
  edits: Record<string, BlockEdit>,
  metrics: TextMetrics,
  reflow: boolean
): LiveBlock[] {
  const resolved = blocks.map((block) => {
    const edit = edits[block.id] ?? {};
    const removed = edit.removed === true;
    const size = edit.size ?? block.size;
    const font = edit.font ?? block.font;
    const color = edit.color ?? block.color;
    const align = edit.align ?? block.align;
    const lineHeight = edit.lineHeight ?? block.lineHeight;
    const background = edit.background ?? block.background;
    const text = removed ? '' : edit.text ?? block.text;

    const lines = text.trim() ? wrapText(text, font, size, block.width, metrics) : [];
    const missing = unsupportedGlyphs(text);
    const changed =
      removed ||
      text !== block.text ||
      size !== block.size ||
      font !== block.font ||
      color !== block.color ||
      align !== block.align ||
      Math.abs(lineHeight - block.lineHeight) > 0.01 ||
      background !== block.background;

    return {
      block, text, removed, size, font, color, align, lineHeight, background,
      lines,
      height: lines.length * lineHeight,
      changed,
      missing,
    };
  });

  const heights = new Map(resolved.map((entry) => [entry.block.id, entry.height]));
  // An untouched block of unsupported text blocks the flow. One the user edited
  // does not: they were warned, and the change is theirs to make.
  const stuck = new Set(
    resolved.filter((entry) => entry.missing.length > 0 && !entry.changed).map((entry) => entry.block.id)
  );
  const shifts = reflow
    ? computeFlowShifts(
        blocks,
        (block) => heights.get(block.id) ?? block.naturalLines * block.lineHeight,
        stuck.size > 0 ? (block) => stuck.has(block.id) : undefined
      )
    : new Map<string, number>();

  return resolved.map((entry) => {
    const shift = shifts.get(entry.block.id) ?? 0;
    return {
      ...entry,
      shift,
      managed: entry.changed || Math.abs(shift) > 0.01,
      wall: stuck.has(entry.block.id) && !shifts.has(entry.block.id),
    };
  });
}
