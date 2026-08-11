import { StandardFonts, degrees, LineCapStyle, type PDFFont, type PDFDocument } from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName, hexToRgb, renderedSize, visualPointToPdf } from './pdf-common';
import type { ToolOutput } from './pdf-common';

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

interface Base {
  id: string;
  /** 0-based page index */
  page: number;
}

/** All coordinates are 0..1 of the *rendered* page, y measured from the top. */
export type Annotation =
  | (Base & {
      kind: 'text';
      x: number; y: number;
      text: string;
      size: number;
      font: AnnotationFontKey;
      color: string;
      opacity: number;
    })
  | (Base & {
      kind: 'image';
      x: number; y: number; width: number; height: number;
      dataUrl: string;
      opacity: number;
    })
  | (Base & {
      kind: 'rect' | 'ellipse' | 'highlight';
      x: number; y: number; width: number; height: number;
      strokeColor: string;
      fillColor: string | null;
      strokeWidth: number;
      opacity: number;
    })
  | (Base & {
      kind: 'line' | 'arrow';
      x1: number; y1: number; x2: number; y2: number;
      strokeColor: string;
      strokeWidth: number;
      opacity: number;
    })
  | (Base & {
      kind: 'draw';
      points: { x: number; y: number }[];
      strokeColor: string;
      strokeWidth: number;
      opacity: number;
    });

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

async function embedDataUrl(doc: PDFDocument, dataUrl: string) {
  let url = dataUrl;
  if (!/^data:image\/(png|jpe?g)/i.test(url)) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the image you added'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    url = canvas.toDataURL('image/png');
  }
  return url.startsWith('data:image/png') ? doc.embedPng(url) : doc.embedJpg(url);
}

export async function applyAnnotations(file: File, annotations: Annotation[]): Promise<ToolOutput> {
  if (annotations.length === 0) throw new Error('Add something to the page before exporting');

  const doc = await loadPdf(file);
  const pages = doc.getPages();

  const fontCache = new Map<AnnotationFontKey, PDFFont>();
  const getFont = async (key: AnnotationFontKey) => {
    const cached = fontCache.get(key);
    if (cached) return cached;
    const font = await doc.embedFont(ANNOTATION_FONTS[key] ?? StandardFonts.Helvetica);
    fontCache.set(key, font);
    return font;
  };

  for (const a of annotations) {
    const page = pages[a.page];
    if (!page) continue;

    const box = page.getMediaBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const view = renderedSize(box.width, box.height, rotation);
    const rotate = degrees(rotation);

    // Map a normalised visual point into absolute PDF user space.
    const P = (nx: number, ny: number) => {
      const p = visualPointToPdf(nx, ny, box.width, box.height, rotation);
      return { x: box.x + p.x, y: box.y + p.y };
    };

    switch (a.kind) {
      case 'text': {
        const font = await getFont(a.font);
        const text = sanitizeForStandardFont(a.text);
        if (!text.trim()) break;
        // y is the top of the first line in the editor; shift down to the baseline.
        const ascent = font.heightAtSize(a.size) * 0.8;
        const anchor = P(a.x, a.y + ascent / view.height);
        page.drawText(text, {
          x: anchor.x,
          y: anchor.y,
          size: a.size,
          font,
          color: hexToRgb(a.color),
          opacity: a.opacity,
          lineHeight: a.size * 1.25,
          rotate,
        });
        break;
      }

      case 'image': {
        const image = await embedDataUrl(doc, a.dataUrl);
        const anchor = P(a.x, a.y + a.height);
        page.drawImage(image, {
          x: anchor.x,
          y: anchor.y,
          width: a.width * view.width,
          height: a.height * view.height,
          opacity: a.opacity,
          rotate,
        });
        break;
      }

      case 'rect':
      case 'highlight': {
        const anchor = P(a.x, a.y + a.height);
        page.drawRectangle({
          x: anchor.x,
          y: anchor.y,
          width: a.width * view.width,
          height: a.height * view.height,
          borderColor: a.kind === 'highlight' ? undefined : hexToRgb(a.strokeColor),
          borderWidth: a.kind === 'highlight' ? 0 : a.strokeWidth,
          color: a.fillColor ? hexToRgb(a.fillColor) : undefined,
          opacity: a.fillColor ? a.opacity : 0,
          borderOpacity: a.opacity,
          rotate,
        });
        break;
      }

      case 'ellipse': {
        const anchor = P(a.x + a.width / 2, a.y + a.height / 2);
        page.drawEllipse({
          x: anchor.x,
          y: anchor.y,
          xScale: (a.width * view.width) / 2,
          yScale: (a.height * view.height) / 2,
          borderColor: hexToRgb(a.strokeColor),
          borderWidth: a.strokeWidth,
          color: a.fillColor ? hexToRgb(a.fillColor) : undefined,
          opacity: a.fillColor ? a.opacity : 0,
          borderOpacity: a.opacity,
          rotate,
        });
        break;
      }

      case 'line':
      case 'arrow': {
        const start = P(a.x1, a.y1);
        const end = P(a.x2, a.y2);
        page.drawLine({
          start, end,
          thickness: a.strokeWidth,
          color: hexToRgb(a.strokeColor),
          opacity: a.opacity,
          lineCap: LineCapStyle.Round,
        });
        if (a.kind === 'arrow') {
          // Build the head in visual space so it survives page rotation.
          const dx = a.x2 - a.x1;
          const dy = a.y2 - a.y1;
          const len = Math.hypot(dx * view.width, dy * view.height);
          if (len > 1) {
            const headLen = Math.max(6, a.strokeWidth * 4);
            const ux = (dx * view.width) / len;
            const uy = (dy * view.height) / len;
            for (const sign of [1, -1]) {
              const angle = Math.PI / 7 * sign;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const bx = -(ux * cos - uy * sin) * headLen;
              const by = -(ux * sin + uy * cos) * headLen;
              const wing = P(a.x2 + bx / view.width, a.y2 + by / view.height);
              page.drawLine({
                start: end, end: wing,
                thickness: a.strokeWidth,
                color: hexToRgb(a.strokeColor),
                opacity: a.opacity,
                lineCap: LineCapStyle.Round,
              });
            }
          }
        }
        break;
      }

      case 'draw': {
        const color = hexToRgb(a.strokeColor);
        for (let i = 1; i < a.points.length; i++) {
          page.drawLine({
            start: P(a.points[i - 1].x, a.points[i - 1].y),
            end: P(a.points[i].x, a.points[i].y),
            thickness: a.strokeWidth,
            color,
            opacity: a.opacity,
            lineCap: LineCapStyle.Round,
          });
        }
        break;
      }
    }
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-edited.pdf` };
}
