import { StandardFonts, degrees, type PDFFont } from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName, hexToRgb, parsePageRange, renderedSize, visualPointToPdf } from './pdf-common';
import type { ToolOutput } from './pdf-common';

export type NumberPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type NumberFontKey = 'Helvetica' | 'Helvetica-Bold' | 'Times' | 'Times-Bold' | 'Courier' | 'Courier-Bold';

export const NUMBER_FONTS: Record<NumberFontKey, StandardFonts> = {
  'Helvetica': StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Times': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Courier': StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold,
};

export type NumeralStyle = 'arabic' | 'roman-lower' | 'roman-upper' | 'alpha-lower' | 'alpha-upper';

export interface PageNumberOptions {
  /** Template with {n} = current number and {N} = total numbered pages. */
  format: string;
  position: NumberPosition;
  font: NumberFontKey;
  size: number;
  color: string;
  /** Horizontal distance from the page edge, in points. */
  marginX: number;
  /** Vertical distance from the page edge, in points. */
  marginY: number;
  /** Value printed on the first numbered page. */
  startAt: number;
  /** Which pages get a number. Empty means every page. */
  pageRange: string;
  /** Swap left/right placement on even pages, for double-sided printing. */
  mirrorMargins: boolean;
  numeralStyle: NumeralStyle;
}

export const DEFAULT_PAGE_NUMBER_OPTIONS: PageNumberOptions = {
  format: '{n}',
  position: 'bottom-center',
  font: 'Helvetica',
  size: 11,
  color: '#334155',
  marginX: 40,
  marginY: 32,
  startAt: 1,
  pageRange: '',
  mirrorMargins: false,
  numeralStyle: 'arabic',
};

const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

function toRoman(n: number): string {
  if (n <= 0) return String(n);
  let rest = n;
  let out = '';
  for (const [value, sym] of ROMAN) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

function toAlpha(n: number): string {
  if (n <= 0) return String(n);
  let rest = n;
  let out = '';
  while (rest > 0) {
    const rem = (rest - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    rest = Math.floor((rest - 1) / 26);
  }
  return out;
}

export function formatNumeral(n: number, style: NumeralStyle): string {
  switch (style) {
    case 'roman-lower': return toRoman(n);
    case 'roman-upper': return toRoman(n).toUpperCase();
    case 'alpha-lower': return toAlpha(n);
    case 'alpha-upper': return toAlpha(n).toUpperCase();
    default: return String(n);
  }
}

export function renderLabel(template: string, n: number, total: number, style: NumeralStyle): string {
  return template
    .replace(/\{n\}/g, formatNumeral(n, style))
    .replace(/\{N\}/g, formatNumeral(total, style));
}

/**
 * Where the label sits on the *rendered* page, expressed as the visual
 * baseline-left point normalised to 0..1. Rotation is applied by the caller.
 */
function visualPlacement(
  position: NumberPosition,
  mirrored: boolean,
  textWidth: number,
  textHeight: number,
  viewW: number,
  viewH: number,
  marginX: number,
  marginY: number
): { nx: number; ny: number } {
  let side = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
  if (mirrored && side !== 'center') side = side === 'left' ? 'right' : 'left';

  let x: number;
  if (side === 'left') x = marginX;
  else if (side === 'right') x = viewW - marginX - textWidth;
  else x = (viewW - textWidth) / 2;

  // ny is measured from the top of the rendered page down to the text baseline.
  const y = position.startsWith('top')
    ? marginY + textHeight
    : viewH - marginY;

  return { nx: x / viewW, ny: y / viewH };
}

export async function addPageNumbers(file: File, options: PageNumberOptions): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  const pages = doc.getPages();
  const total = pages.length;

  const targets = parsePageRange(options.pageRange, total);
  if (targets.length === 0) throw new Error('The page range does not match any page in this document');

  const font: PDFFont = await doc.embedFont(NUMBER_FONTS[options.font] ?? StandardFonts.Helvetica);
  const color = hexToRgb(options.color);
  const targetSet = new Set(targets);

  let counter = options.startAt;
  const numberedTotal = targets.length + options.startAt - 1;

  for (let i = 0; i < total; i++) {
    if (!targetSet.has(i + 1)) continue;

    const page = pages[i];
    const box = page.getMediaBox();
    const pw = box.width;
    const ph = box.height;
    const rotation = page.getRotation().angle;
    const view = renderedSize(pw, ph, rotation);

    const label = renderLabel(options.format, counter, numberedTotal, options.numeralStyle);
    counter++;
    if (!label) continue;

    const textWidth = font.widthOfTextAtSize(label, options.size);
    const textHeight = font.heightAtSize(options.size);
    const mirrored = options.mirrorMargins && (i + 1) % 2 === 0;

    const { nx, ny } = visualPlacement(
      options.position, mirrored, textWidth, textHeight,
      view.width, view.height, options.marginX, options.marginY
    );

    // Baseline-left in the rendered frame → PDF user space.
    const anchor = visualPointToPdf(nx, ny, pw, ph, rotation);

    page.drawText(label, {
      x: box.x + anchor.x,
      y: box.y + anchor.y,
      size: options.size,
      font,
      color,
      rotate: degrees(((rotation % 360) + 360) % 360),
    });
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-numbered.pdf` };
}
