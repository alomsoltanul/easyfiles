import {
  type PDFArray,
  PDFContentStream,
  PDFRawStream,
  decodePDFRawStream,
  type PDFDocument,
  type PDFPage,
} from '@cantoo/pdf-lib';

/**
 * Deletes original glyph runs from a page's content stream.
 *
 * Painting a rectangle over a sentence hides it, but the words are still in the
 * file — copy the page and they come straight back out. For "delete this text"
 * to mean anything the run has to leave the content stream.
 *
 * The catch is spacing: dropping a show operator loses the advance that the
 * *next* operator on the line depends on, and recovering it would mean decoding
 * every embedded font. So this only removes a text object (a `BT … ET` block)
 * when every run inside it is one we were asked to delete and every one of
 * those runs is explicitly positioned. Anything else is left exactly as it was
 * and stays hidden under its patch instead. Conservative, but it can never
 * scramble a page.
 */

export interface RunAnchor {
  /** Absolute PDF user space, the origin of the text run. */
  x: number;
  y: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `a` applied first, then `b` — the order PDF's `cm` and `Tm` compose in. */
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

const applyTo = (m: Matrix, x: number, y: number) => ({
  x: x * m[0] + y * m[2] + m[4],
  y: x * m[1] + y * m[3] + m[5],
});

/* ------------------------------------------------------------------ */
/* Tokeniser                                                           */
/* ------------------------------------------------------------------ */

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITER = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

interface Token {
  /** Byte offset of the token's first character. */
  start: number;
  end: number;
  /** Operator name, or null for an operand. */
  op: string | null;
  /** Numeric value, when the operand is a number. */
  number?: number;
}

/**
 * Split a content stream into operands and operators. Strings, names, arrays,
 * dictionaries, comments and inline images are recognised only well enough to
 * be skipped without confusing their contents for operators.
 */
function tokenize(bytes: Uint8Array): Token[] {
  const tokens: Token[] = [];
  const size = bytes.length;
  let i = 0;

  const text = (from: number, to: number) => {
    let out = '';
    for (let n = from; n < to; n++) out += String.fromCharCode(bytes[n]);
    return out;
  };

  while (i < size) {
    const byte = bytes[i];

    if (WHITESPACE.has(byte)) { i++; continue; }

    if (byte === 0x25) { // comment
      while (i < size && bytes[i] !== 0x0a && bytes[i] !== 0x0d) i++;
      continue;
    }

    if (byte === 0x28) { // ( literal string )
      const start = i++;
      let depth = 1;
      while (i < size && depth > 0) {
        if (bytes[i] === 0x5c) { i += 2; continue; }
        if (bytes[i] === 0x28) depth++;
        else if (bytes[i] === 0x29) depth--;
        i++;
      }
      tokens.push({ start, end: i, op: null });
      continue;
    }

    if (byte === 0x3c) { // << dict >>  or  <hex>
      const start = i;
      if (bytes[i + 1] === 0x3c) { i += 2; tokens.push({ start, end: i, op: null }); continue; }
      i++;
      while (i < size && bytes[i] !== 0x3e) i++;
      i++;
      tokens.push({ start, end: i, op: null });
      continue;
    }

    if (byte === 0x3e) { // >>
      const start = i;
      i += bytes[i + 1] === 0x3e ? 2 : 1;
      tokens.push({ start, end: i, op: null });
      continue;
    }

    if (byte === 0x2f) { // /Name
      const start = i++;
      while (i < size && !WHITESPACE.has(bytes[i]) && !DELIMITER.has(bytes[i])) i++;
      tokens.push({ start, end: i, op: null });
      continue;
    }

    if (byte === 0x5b || byte === 0x5d || byte === 0x7b || byte === 0x7d) {
      tokens.push({ start: i, end: i + 1, op: null });
      i++;
      continue;
    }

    const start = i;
    while (i < size && !WHITESPACE.has(bytes[i]) && !DELIMITER.has(bytes[i])) i++;
    if (i === start) { i++; continue; }

    const word = text(start, i);
    const numeric = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(word);
    if (numeric) {
      tokens.push({ start, end: i, op: null, number: parseFloat(word) });
      continue;
    }

    tokens.push({ start, end: i, op: word });

    if (word === 'BI') {
      // Inline image: everything between ID and EI is raw sample data.
      while (i < size) {
        if (bytes[i] === 0x49 && bytes[i + 1] === 0x44 && (i + 2 >= size || WHITESPACE.has(bytes[i + 2]))) {
          i += 3;
          while (i < size) {
            if (
              bytes[i] === 0x45 && bytes[i + 1] === 0x49 &&
              WHITESPACE.has(bytes[i - 1]) &&
              (i + 2 >= size || WHITESPACE.has(bytes[i + 2]) || DELIMITER.has(bytes[i + 2]))
            ) { i += 2; break; }
            i++;
          }
          break;
        }
        i++;
      }
    }
  }

  return tokens;
}

/* ------------------------------------------------------------------ */
/* Page content                                                        */
/* ------------------------------------------------------------------ */

function pageContent(doc: PDFDocument, page: PDFPage): { bytes: Uint8Array; contents: PDFArray } | null {
  const { Contents } = page.node.normalizedEntries();
  if (!Contents) return null;

  // A page's content can be split across several streams, and pdf-lib wraps
  // whatever it loaded in `q` / `Q` streams of its own. Operators are only
  // meaningful in their concatenation, so the parts are joined before parsing.
  const parts: Uint8Array[] = [];
  for (const entry of Contents.asArray()) {
    const stream = doc.context.lookup(entry);
    try {
      if (stream instanceof PDFRawStream) parts.push(decodePDFRawStream(stream).decode());
      else if (stream instanceof PDFContentStream) parts.push(stream.getUnencodedContents());
      else return null;
    } catch {
      return null;
    }
  }
  if (parts.length === 0) return null;

  const total = parts.reduce((sum, part) => sum + part.length + 1, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
    bytes[at++] = 0x0a;
  }
  return { bytes, contents: Contents };
}

/* ------------------------------------------------------------------ */
/* Removal                                                             */
/* ------------------------------------------------------------------ */

const keyOf = (x: number, y: number) => `${Math.round(x)}|${Math.round(y)}`;

/** Nearest listed anchor within about a point, or null. */
function findAnchor(wanted: Set<string>, x: number, y: number): string | null {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = keyOf(x + dx, y + dy);
      if (wanted.has(key)) return key;
    }
  }
  return null;
}

/**
 * Remove the runs starting at `anchors` from the page, and report which ones
 * actually went. Callers use the report to decide whether a block still needs
 * painting over: a run that left the file needs no patch, so whatever was
 * drawn beneath it — a table rule, a tint — survives untouched.
 */
export function stripTextRuns(doc: PDFDocument, page: PDFPage, anchors: RunAnchor[]): Set<string> {
  const removed = new Set<string>();
  if (anchors.length === 0) return removed;

  const wanted = new Set(anchors.map((anchor) => keyOf(anchor.x, anchor.y)));
  const content = pageContent(doc, page);
  if (!content) return removed;

  const { bytes, contents } = content;
  const tokens = tokenize(bytes);

  const graphics: Matrix[] = [];
  let ctm: Matrix = IDENTITY;

  let objectStart = -1;
  let matrix: Matrix = IDENTITY;
  let lineMatrix: Matrix = IDENTITY;
  let leading = 0;
  let placed = false;
  /** Anchors matched inside the current text object. */
  let matched: string[] = [];
  /** False as soon as the object shows a run we cannot account for. */
  let clean = true;

  const cuts: { start: number; end: number; keys: string[] }[] = [];
  const operands: number[] = [];

  const newline = () => {
    lineMatrix = multiply([1, 0, 0, 1, 0, -leading], lineMatrix);
    matrix = lineMatrix;
    placed = true;
  };

  const show = () => {
    if (!placed) { clean = false; return; }
    const at = applyTo(ctm, matrix[4], matrix[5]);
    const key = findAnchor(wanted, at.x, at.y);
    if (key) matched.push(key);
    else clean = false;
    // The advance is unknown without the font's widths, so the next run has to
    // reposition itself explicitly before we will touch it.
    placed = false;
  };

  for (const token of tokens) {
    if (token.op === null) {
      if (token.number !== undefined) operands.push(token.number);
      else operands.length = 0;
      continue;
    }

    const args = operands.slice();
    operands.length = 0;

    switch (token.op) {
      case 'q':
        graphics.push(ctm);
        break;
      case 'Q':
        ctm = graphics.pop() ?? IDENTITY;
        break;
      case 'cm':
        if (args.length >= 6) ctm = multiply(args.slice(-6) as Matrix, ctm);
        break;

      case 'BT':
        objectStart = token.start;
        matrix = IDENTITY;
        lineMatrix = IDENTITY;
        placed = true;
        matched = [];
        clean = true;
        break;

      case 'ET':
        if (objectStart >= 0 && clean && matched.length > 0) {
          cuts.push({ start: objectStart, end: token.end, keys: matched });
        }
        objectStart = -1;
        break;

      case 'Tm':
        if (args.length >= 6) {
          matrix = args.slice(-6) as Matrix;
          lineMatrix = matrix;
          placed = true;
        } else clean = false;
        break;

      case 'TL':
        if (args.length >= 1) leading = args[args.length - 1];
        break;

      case 'TD':
        if (args.length >= 2) leading = -args[args.length - 1];
      // falls through — TD is Td with the leading set first
      case 'Td':
        if (args.length >= 2) {
          lineMatrix = multiply([1, 0, 0, 1, args[args.length - 2], args[args.length - 1]], lineMatrix);
          matrix = lineMatrix;
          placed = true;
        } else clean = false;
        break;

      case 'T*':
        newline();
        break;

      case 'Tj':
      case 'TJ':
        show();
        break;

      case "'":
        newline();
        show();
        break;

      case '"':
        newline();
        show();
        break;

      default:
        break;
    }
  }

  if (cuts.length === 0) return removed;

  // Splice the removable text objects out and hand the page a fresh stream.
  cuts.sort((a, b) => a.start - b.start);
  const kept: Uint8Array[] = [];
  let at = 0;
  for (const cut of cuts) {
    if (cut.start < at) continue;
    kept.push(bytes.subarray(at, cut.start));
    at = cut.end;
    for (const key of cut.keys) removed.add(key);
  }
  kept.push(bytes.subarray(at));

  const length = kept.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(length);
  let cursor = 0;
  for (const part of kept) { merged.set(part, cursor); cursor += part.length; }

  const ref = doc.context.register(doc.context.flateStream(merged));
  while (contents.size() > 0) contents.remove(0);
  contents.push(ref);

  return removed;
}
