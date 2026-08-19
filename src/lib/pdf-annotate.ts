import { StandardFonts, degrees, LineCapStyle, type PDFFont, type PDFDocument } from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName, hexToRgb, renderedSize, visualPointToPdf } from './pdf-common';
import type { ToolOutput } from './pdf-common';
import { stripTextRuns, type RunAnchor } from './pdf-text-remove';
import {
  ANNOTATION_FONTS,
  getTextMetrics,
  layoutLine,
  sanitizeForStandardFont,
  wrapText,
  type AnnotationFontKey,
  type TextAlign,
} from './pdf-text-metrics';

export {
  ANNOTATION_FONTS,
  FONT_KEYS,
  sanitizeForStandardFont,
  unsupportedGlyphs,
  fontCss,
  nearestStandardFont,
  restyleFont,
  isBoldFont,
  isItalicFont,
} from './pdf-text-metrics';
export type { AnnotationFontKey, TextAlign } from './pdf-text-metrics';

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
      /**
       * A run of the document's own text, re-typeset. Unlike every other
       * annotation this one is measured in PDF user space: the original glyphs
       * are painted over with `background`, then `text` is re-wrapped inside
       * `box` and drawn. That keeps it exact under any page rotation, because
       * nothing has to round-trip through screen coordinates.
       */
      kind: 'textblock';
      /** Rectangle of the original glyphs, painted over before redrawing. */
      cover: { x: number; y: number; width: number; height: number };
      background: string;
      /** Where the replacement text goes. `top` is the top edge, y-up space. */
      box: { x: number; top: number; width: number };
      text: string;
      size: number;
      font: AnnotationFontKey;
      color: string;
      lineHeight: number;
      align: TextAlign;
      /** Top of the box down to the first baseline, in points. */
      ascent: number;
      /** Start of each original glyph run, relative to the crop box. */
      anchors: RunAnchor[];
      opacity: number;
    })
  | (Base & {
      kind: 'draw';
      points: { x: number; y: number }[];
      strokeColor: string;
      strokeWidth: number;
      opacity: number;
    });

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
  const metrics = await getTextMetrics();

  const fontCache = new Map<AnnotationFontKey, PDFFont>();
  const getFont = async (key: AnnotationFontKey) => {
    const cached = fontCache.get(key);
    if (cached) return cached;
    const font = await doc.embedFont(ANNOTATION_FONTS[key] ?? StandardFonts.Helvetica);
    fontCache.set(key, font);
    return font;
  };

  // Re-typeset document text goes down first: anything the user drew on top of
  // it — a highlight, a signature — has to stay on top after the rewrite.
  const ordered = [...annotations].sort(
    (a, b) => (a.kind === 'textblock' ? 0 : 1) - (b.kind === 'textblock' ? 0 : 1)
  );

  // Deleting the old glyph runs has to happen before anything is drawn: it
  // rewrites the page's content stream, which would throw away drawings made
  // first. What it manages to remove decides which blocks still need a patch.
  const erased = new Map<number, Set<string>>();
  for (const a of ordered) {
    if (a.kind !== 'textblock' || a.anchors.length === 0) continue;
    const page = pages[a.page];
    if (!page || erased.has(a.page)) continue;
    const crop = page.getCropBox();
    const anchors = ordered.flatMap((other) =>
      other.kind === 'textblock' && other.page === a.page
        ? other.anchors.map((anchor) => ({ x: crop.x + anchor.x, y: crop.y + anchor.y }))
        : []
    );
    try {
      erased.set(a.page, stripTextRuns(doc, page, anchors));
    } catch {
      // Any stream we cannot rewrite safely keeps its text and gets a patch.
      erased.set(a.page, new Set<string>());
    }
  }

  // Same two passes as the editor preview: every patch first, then every line
  // of text. A block that moved down can land on the rectangle its neighbour
  // needs painted out, and interleaving the two would clip the new lines.
  for (const a of ordered) {
    if (a.kind !== 'textblock') continue;
    const page = pages[a.page];
    if (!page) continue;
    const crop = page.getCropBox();
    const gone = erased.get(a.page);
    // Runs that were deleted outright need no patch, so anything drawn under
    // them — a table rule, a tinted cell — stays visible.
    const lifted =
      a.anchors.length > 0 &&
      !!gone &&
      a.anchors.every((anchor) => gone.has(`${Math.round(crop.x + anchor.x)}|${Math.round(crop.y + anchor.y)}`));
    if (lifted) continue;
    page.drawRectangle({
      x: crop.x + a.cover.x,
      y: crop.y + a.cover.y,
      width: a.cover.width,
      height: a.cover.height,
      color: hexToRgb(a.background),
      borderWidth: 0,
    });
  }

  for (const a of ordered) {
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

      case 'textblock': {
        // Extraction measured everything from the crop box origin, which is
        // what pdf.js renders from; drawing has to start from the same corner.
        const crop = page.getCropBox();
        const ox = crop.x;
        const oy = crop.y;

        const body = sanitizeForStandardFont(a.text);
        if (!body.trim()) break;

        const font = await getFont(a.font);
        const lines = wrapText(body, a.font, a.size, a.box.width, metrics);
        lines.forEach((line, index) => {
          const baseline = oy + a.box.top - a.ascent - index * a.lineHeight;
          for (const run of layoutLine(line, a.font, a.size, a.box.width, a.align, metrics)) {
            page.drawText(run.text, {
              x: ox + a.box.x + run.x,
              y: baseline,
              size: a.size,
              font,
              color: hexToRgb(a.color),
              opacity: a.opacity,
            });
          }
        });
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
