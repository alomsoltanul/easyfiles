import { PDFDocument, StandardFonts, type PDFFont } from '@cantoo/pdf-lib';

/**
 * Text measurement shared by the editor preview and the PDF writer.
 *
 * Line breaking has to agree in both places: if the browser wrapped a paragraph
 * differently from pdf-lib, the exported file would not match what the user
 * edited. So every wrap decision is made here, against the same font metrics
 * pdf-lib uses at draw time, and the preview simply lays out the lines it is
 * given.
 */

export type AnnotationFontKey =
  | 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique'
  | 'Times' | 'Times-Bold' | 'Times-Italic'
  | 'Courier' | 'Courier-Bold';

export const ANNOTATION_FONTS: Record<AnnotationFontKey, StandardFonts> = {
  'Helvetica': StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Helvetica-Oblique': StandardFonts.HelveticaOblique,
  'Times': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Times-Italic': StandardFonts.TimesRomanItalic,
  'Courier': StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold,
};

export const FONT_KEYS = Object.keys(ANNOTATION_FONTS) as AnnotationFontKey[];

/**
 * The 14 standard PDF fonts are WinAnsi-encoded, so anything outside that
 * range would make pdf-lib throw at draw time. Map the common typographic
 * characters and drop the rest rather than failing the whole export.
 */
const CHAR_FIXES: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': ',',
  '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u2022': '-',
  '\u00A0': ' ', '\u2028': '\n', '\u2029': '\n', '\t': '    ',
  '\uFB01': 'fi', '\uFB02': 'fl', '\u2212': '-', '\u00AD': '',
};

export function sanitizeForStandardFont(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === '\n') { out += ch; continue; }
    const fixed = CHAR_FIXES[ch];
    if (fixed !== undefined) { out += fixed; continue; }
    out += ch.charCodeAt(0) <= 0xff ? ch : '?';
  }
  return out;
}

/**
 * Characters the standard fonts cannot draw, which `sanitizeForStandardFont`
 * would turn into question marks. Callers warn before an edit silently
 * transliterates someone's Japanese or Greek into nonsense.
 */
export function unsupportedGlyphs(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    if (ch === '\n' || CHAR_FIXES[ch] !== undefined) continue;
    if (ch.charCodeAt(0) > 0xff) out.add(ch);
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export interface TextMetrics {
  /** Width of `text` at `size`, in points. */
  width: (text: string, font: AnnotationFontKey, size: number) => number;
  /** Distance from the top of a line box down to the baseline, in points. */
  ascent: (font: AnnotationFontKey, size: number) => number;
}

let metricsPromise: Promise<TextMetrics> | null = null;

/**
 * Embed the standard fonts once into a throwaway document and hand back a
 * measuring function. Cheap after the first call — the same fonts are reused.
 */
export async function getTextMetrics(): Promise<TextMetrics> {
  if (!metricsPromise) {
    metricsPromise = (async () => {
      const doc = await PDFDocument.create();
      const fonts = new Map<AnnotationFontKey, PDFFont>();
      for (const key of FONT_KEYS) fonts.set(key, await doc.embedFont(ANNOTATION_FONTS[key]));

      const pick = (key: AnnotationFontKey) => fonts.get(key) ?? fonts.get('Helvetica')!;

      return {
        width(text: string, font: AnnotationFontKey, size: number) {
          if (!text) return 0;
          try {
            return pick(font).widthOfTextAtSize(sanitizeForStandardFont(text), size);
          } catch {
            return text.length * size * 0.5;
          }
        },
        ascent(font: AnnotationFontKey, size: number) {
          try {
            return pick(font).heightAtSize(size, { descender: false });
          } catch {
            return size * 0.8;
          }
        },
      };
    })().catch((err) => {
      metricsPromise = null;
      throw err;
    });
  }
  return metricsPromise;
}

/* ------------------------------------------------------------------ */
/* Font guessing                                                       */
/* ------------------------------------------------------------------ */

const SERIF = /times|serif(?!-)|roman|georgia|garamond|minion|cambria|palatino|book(?!man old)|caslon|baskerville|didot|utopia|charter|constantia/i;
const MONO = /courier|mono|consol|menlo|inconsolata|source ?code|dejavu ?sans ?mono/i;

/**
 * Resolve an embedded font name to the nearest of the standard fonts we can
 * actually draw with. Embedded subsets cannot be reused for new glyphs, so a
 * lookalike is the honest best we can do.
 */
export function nearestStandardFont(fontName: string, cssFamily?: string): AnnotationFontKey {
  const name = fontName || '';
  const bold = /bold|black|heavy|semibold|demibold|[-,_]bd\b|[-,_]b\b/i.test(name);
  const italic = /italic|oblique|[-,_]it\b/i.test(name);

  const mono = MONO.test(name) || /monospace/i.test(cssFamily ?? '');
  const serif = SERIF.test(name) || /^serif$/i.test((cssFamily ?? '').trim());

  if (mono) return bold ? 'Courier-Bold' : 'Courier';
  if (serif) return bold ? 'Times-Bold' : italic ? 'Times-Italic' : 'Times';
  return bold ? 'Helvetica-Bold' : italic ? 'Helvetica-Oblique' : 'Helvetica';
}

/** Swap the weight/slant of a font key while keeping its family. */
export function restyleFont(
  key: AnnotationFontKey,
  change: { bold?: boolean; italic?: boolean }
): AnnotationFontKey {
  const serif = key.startsWith('Times');
  const mono = key.startsWith('Courier');
  const bold = change.bold ?? /Bold/.test(key);
  const italic = change.italic ?? /Italic|Oblique/.test(key);

  if (mono) return bold ? 'Courier-Bold' : 'Courier';
  if (serif) return bold ? 'Times-Bold' : italic ? 'Times-Italic' : 'Times';
  return bold ? 'Helvetica-Bold' : italic ? 'Helvetica-Oblique' : 'Helvetica';
}

export const isBoldFont = (key: AnnotationFontKey) => /Bold/.test(key);
export const isItalicFont = (key: AnnotationFontKey) => /Italic|Oblique/.test(key);

/** CSS the browser can render that is closest to a standard PDF font. */
export function fontCss(key: AnnotationFontKey) {
  return {
    fontFamily: key.startsWith('Times')
      ? '"Times New Roman", Times, serif'
      : key.startsWith('Courier')
        ? '"Courier New", Courier, monospace'
        : 'Helvetica, Arial, sans-serif',
    fontWeight: isBoldFont(key) ? 700 : 400,
    fontStyle: isItalicFont(key) ? ('italic' as const) : ('normal' as const),
  };
}

/* ------------------------------------------------------------------ */
/* Wrapping                                                            */
/* ------------------------------------------------------------------ */

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface WrappedLine {
  text: string;
  /** Measured width at the block's font and size, in points. */
  width: number;
  /**
   * False for the last visual line of a paragraph — a justified block leaves
   * that one ragged, exactly as a typesetter would.
   */
  stretch: boolean;
}

const splitWords = (line: string) => line.split(/(?<=\s)/).filter((chunk) => chunk.length > 0);

/**
 * Greedy word wrap at `maxWidth` points. Words longer than the measure are
 * broken by character so nothing ever spills outside the block.
 */
export function wrapText(
  text: string,
  font: AnnotationFontKey,
  size: number,
  maxWidth: number,
  metrics: TextMetrics
): WrappedLine[] {
  const out: WrappedLine[] = [];
  const limit = Math.max(size * 0.6, maxWidth);

  for (const paragraph of text.split('\n')) {
    const words = splitWords(paragraph);
    if (words.length === 0) {
      out.push({ text: '', width: 0, stretch: false });
      continue;
    }

    let line = '';
    const flush = (stretch: boolean) => {
      const trimmed = line.replace(/\s+$/, '');
      out.push({ text: trimmed, width: metrics.width(trimmed, font, size), stretch });
      line = '';
    };

    for (const word of words) {
      const candidate = line + word;
      if (line && metrics.width(candidate.replace(/\s+$/, ''), font, size) > limit) {
        flush(true);
        line = word.replace(/^\s+/, '');
      } else {
        line = candidate;
      }

      // A single word wider than the block: chop it until it fits.
      while (metrics.width(line.replace(/\s+$/, ''), font, size) > limit && line.replace(/\s+$/, '').length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && metrics.width(line.slice(0, cut), font, size) > limit) cut--;
        const head = line.slice(0, cut);
        out.push({ text: head, width: metrics.width(head, font, size), stretch: false });
        line = line.slice(cut);
      }
    }
    flush(false);
  }

  return out;
}

/**
 * Where each word of a line sits, in points from the block's left edge.
 * Justified lines spread their gaps to fill the measure; everything else is a
 * single run positioned by the alignment.
 */
export function layoutLine(
  line: WrappedLine,
  font: AnnotationFontKey,
  size: number,
  boxWidth: number,
  align: TextAlign,
  metrics: TextMetrics
): { text: string; x: number }[] {
  if (!line.text) return [];

  if (align === 'justify' && line.stretch) {
    const words = line.text.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const inked = words.reduce((sum, word) => sum + metrics.width(word, font, size), 0);
      const gap = (boxWidth - inked) / (words.length - 1);
      // Runaway gaps look worse than a ragged edge — fall back to flush left.
      if (gap > 0 && gap < size * 2.5) {
        let x = 0;
        return words.map((word) => {
          const at = { text: word, x };
          x += metrics.width(word, font, size) + gap;
          return at;
        });
      }
    }
  }

  const x =
    align === 'center' ? (boxWidth - line.width) / 2 :
    align === 'right' ? boxWidth - line.width :
    0;
  return [{ text: line.text, x: Math.max(0, x) }];
}
