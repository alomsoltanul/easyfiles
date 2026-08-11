import { PDFDocument, PDFDict, PDFName, PDFHexString, PDFArray, PDFStream } from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName } from './pdf-common';
import type { ProgressFn, ToolOutput } from './pdf-common';
import { buildSRGBProfile, SRGB_PROFILE_NAME } from './icc-srgb';

export type PdfAPart = '1b' | '2b' | '3b';

export interface PdfAOptions {
  part: PdfAPart;
  /**
   * `rasterize` re-renders every page as an image, which removes all font and
   * transparency dependencies and therefore always conforms. `preserve` keeps
   * the original text and vectors, so conformance depends on the source fonts.
   */
  mode: 'preserve' | 'rasterize';
  dpi: number;
  title: string;
  author: string;
}

export const DEFAULT_PDFA_OPTIONS: PdfAOptions = {
  part: '2b',
  mode: 'preserve',
  dpi: 200,
  title: '',
  author: '',
};

export interface FontAudit {
  name: string;
  subtype: string;
  embedded: boolean;
}

export interface PdfAResult extends ToolOutput {
  part: PdfAPart;
  mode: PdfAOptions['mode'];
  fonts: FontAudit[];
  warnings: string[];
}

const PART_META: Record<PdfAPart, { part: string; conformance: string; intent: string }> = {
  '1b': { part: '1', conformance: 'B', intent: 'GTS_PDFA1' },
  '2b': { part: '2', conformance: 'B', intent: 'GTS_PDFA1' },
  '3b': { part: '3', conformance: 'B', intent: 'GTS_PDFA1' },
};

/**
 * Walk every font dictionary and report whether the program is embedded.
 * A PDF/A file must embed every font it uses, so this is the single most
 * common reason a "preserve" conversion would fail validation.
 */
export function auditFonts(doc: PDFDocument): FontAudit[] {
  const fonts: FontAudit[] = [];
  const seen = new Set<string>();

  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const type = object.get(PDFName.of('Type'));
    if (!(type instanceof PDFName) || type.asString() !== '/Font') continue;

    const subtypeObj = object.get(PDFName.of('Subtype'));
    const subtype = subtypeObj instanceof PDFName ? subtypeObj.asString().replace('/', '') : 'Unknown';
    const baseFontObj = object.get(PDFName.of('BaseFont'));
    const name = baseFontObj instanceof PDFName
      ? baseFontObj.asString().replace('/', '').replace(/^[A-Z]{6}\+/, '')
      : 'Unnamed font';

    // Type0 fonts carry the program on their descendant.
    let descriptor = object.get(PDFName.of('FontDescriptor'));
    if (!descriptor && subtype === 'Type0') {
      const descendants = object.get(PDFName.of('DescendantFonts'));
      const array = descendants instanceof PDFArray
        ? descendants
        : doc.context.lookupMaybe(descendants, PDFArray);
      const first = array && array.size() > 0 ? array.get(0) : undefined;
      const child = first ? doc.context.lookupMaybe(first, PDFDict) : undefined;
      descriptor = child?.get(PDFName.of('FontDescriptor'));
    }

    const descriptorDict = descriptor ? doc.context.lookupMaybe(descriptor, PDFDict) : undefined;
    const embedded = Boolean(
      descriptorDict &&
      (descriptorDict.get(PDFName.of('FontFile')) ||
        descriptorDict.get(PDFName.of('FontFile2')) ||
        descriptorDict.get(PDFName.of('FontFile3')))
    );

    const key = `${name}|${subtype}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fonts.push({ name, subtype, embedded });
  }

  return fonts;
}

function xmpPacket(options: PdfAOptions, part: string, conformance: string): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escape(options.title || 'Untitled')}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escape(options.author || 'Unknown')}</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>ConvertTools</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>ConvertTools PDF/A converter</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Attach the output intent, XMP metadata and file identifier PDF/A requires. */
function applyArchivalStructure(doc: PDFDocument, options: PdfAOptions) {
  const meta = PART_META[options.part];

  // 1. Destination profile — an uncompressed ICC stream with an /N of 3.
  const profile = buildSRGBProfile();
  const profileStream = doc.context.stream(profile, {
    N: 3,
    Alternate: PDFName.of('DeviceRGB'),
  });
  const profileRef = doc.context.register(profileStream);

  // 2. Output intent pointing at that profile.
  const intent = doc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of(meta.intent),
    OutputConditionIdentifier: PDFHexString.fromText(SRGB_PROFILE_NAME),
    Info: PDFHexString.fromText(SRGB_PROFILE_NAME),
    RegistryName: PDFHexString.fromText('http://www.color.org'),
    DestOutputProfile: profileRef,
  });
  const intentRef = doc.context.register(intent);
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([intentRef]));

  // 3. XMP packet — must stay unfiltered so validators can read it directly.
  const packet = xmpPacket(options, meta.part, meta.conformance);
  const metadataStream = doc.context.stream(packet, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(metadataStream));

  // 4. Trailer /ID is mandatory in every PDF/A part.
  const id = PDFHexString.of(randomHex(16));
  doc.context.trailerInfo.ID = doc.context.obj([id, id]);

  // 5. Things PDF/A forbids outright.
  doc.catalog.delete(PDFName.of('OpenAction'));
  doc.catalog.delete(PDFName.of('AA'));
  const names = doc.catalog.get(PDFName.of('Names'));
  const namesDict = names ? doc.context.lookupMaybe(names, PDFDict) : undefined;
  namesDict?.delete(PDFName.of('JavaScript'));

  // 6. PDF/A-1 is pinned to PDF 1.4, which predates object and xref streams.
  //    pdf-lib inlines the objects it finds in an /ObjStm but leaves the
  //    container behind, so drop those husks before writing.
  if (options.part === '1b') {
    for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
      const dict = object instanceof PDFStream ? object.dict : object instanceof PDFDict ? object : null;
      const type = dict?.get(PDFName.of('Type'));
      if (type instanceof PDFName && (type.asString() === '/ObjStm' || type.asString() === '/XRef')) {
        doc.context.delete(ref);
      }
    }
  }
}

async function rasterizeInto(file: File, dpi: number, onProgress?: ProgressFn): Promise<PDFDocument> {
  const { renderPagesToCanvases } = await import('./pdf-render');
  const source = await loadPdf(file);
  const sizes = source.getPages().map((p) => {
    const box = p.getMediaBox();
    const rotation = ((p.getRotation().angle % 360) + 360) % 360;
    return rotation === 90 || rotation === 270
      ? { width: box.height, height: box.width }
      : { width: box.width, height: box.height };
  });

  const out = await PDFDocument.create();
  const scale = Math.max(0.5, Math.min(4, dpi / 72));
  let done = 0;

  await renderPagesToCanvases(file, scale, async (canvas, pageIndex) => {
    const image = await out.embedJpg(canvas.toDataURL('image/jpeg', 0.92));
    const size = sizes[pageIndex] ?? { width: canvas.width / scale, height: canvas.height / scale };
    const page = out.addPage([size.width, size.height]);
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    done++;
    onProgress?.(Math.round((done / sizes.length) * 80));
  });

  return out;
}

export async function convertToPdfA(
  file: File,
  options: PdfAOptions,
  onProgress?: ProgressFn
): Promise<PdfAResult> {
  const source = await loadPdf(file);
  const fonts = auditFonts(source);
  const warnings: string[] = [];
  onProgress?.(10);

  let doc: PDFDocument;

  if (options.mode === 'rasterize') {
    doc = await rasterizeInto(file, options.dpi, onProgress);
    warnings.push('Pages were converted to images — the document is no longer searchable or selectable.');
  } else {
    doc = source;
    const missing = fonts.filter((f) => !f.embedded);
    if (missing.length > 0) {
      warnings.push(
        `${missing.length} font${missing.length === 1 ? '' : 's'} (${missing.slice(0, 3).map((f) => f.name).join(', ')}${missing.length > 3 ? '…' : ''}) are referenced but not embedded. PDF/A requires embedded fonts — switch to "Rasterize pages" for a guaranteed-conformant file.`
      );
    }
    if (options.part === '1b') {
      warnings.push('PDF/A-1b forbids transparency. Source artwork that uses it will not validate in preserve mode.');
    }
  }

  onProgress?.(85);

  doc.setTitle(options.title || baseName(file));
  doc.setAuthor(options.author || 'Unknown');
  doc.setProducer('ConvertTools PDF/A converter');
  doc.setCreator('ConvertTools');
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  applyArchivalStructure(doc, options);

  // Object streams and cross-reference streams are banned in PDF/A-1.
  const bytes = await doc.save({
    useObjectStreams: options.part !== '1b',
  });

  // pdf-lib always stamps %PDF-1.7. PDF/A-1 is defined against PDF 1.4, and the
  // body has already been stripped of everything newer, so rewrite the header
  // in place — it is the same byte length, so no offset shifts.
  if (options.part === '1b') {
    const header = new TextEncoder().encode('%PDF-1.4');
    if (bytes.length > header.length && bytes[0] === 0x25) bytes.set(header, 0);
  }

  onProgress?.(100);

  return {
    blob: toBlob(bytes),
    name: `${baseName(file)}-pdfa-${options.part}.pdf`,
    part: options.part,
    mode: options.mode,
    fonts,
    warnings,
  };
}

/** Report whether a file already declares PDF/A conformance in its XMP packet. */
export async function detectPdfA(file: File): Promise<{ isPdfA: boolean; part?: string; conformance?: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const part = /<pdfaid:part>\s*(\d)\s*<\/pdfaid:part>/.exec(text)?.[1]
    ?? /pdfaid:part\s*=\s*"(\d)"/.exec(text)?.[1];
  const conformance = /<pdfaid:conformance>\s*([ABU])\s*<\/pdfaid:conformance>/i.exec(text)?.[1]
    ?? /pdfaid:conformance\s*=\s*"([ABU])"/i.exec(text)?.[1];
  return { isPdfA: Boolean(part), part, conformance };
}
