import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFDocument,
  type PDFField,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { loadPdf, toBlob, baseName, renderedSize, visualPointToPdf } from './pdf-common';
import type { NormRect, ToolOutput } from './pdf-common';

export type FieldKind = 'text' | 'checkbox' | 'dropdown' | 'optionlist' | 'radio' | 'signature' | 'button';

export interface FormFieldInfo {
  name: string;
  kind: FieldKind;
  value: string;
  /** Multi-select lists keep every selected entry. */
  values: string[];
  options: string[];
  required: boolean;
  readOnly: boolean;
  multiline: boolean;
  maxLength?: number;
  /** 0-based page index of the first widget, or -1 when unplaced. */
  page: number;
  /** Widget box on the rendered page, normalised, y from the top. */
  rects: { page: number; rect: NormRect }[];
}

function kindOf(field: PDFField): FieldKind {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'optionlist';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFSignature) return 'signature';
  return 'button';
}

/** Map every widget of a field onto a normalised rect on its rendered page. */
function widgetRects(doc: PDFDocument, field: PDFField): { page: number; rect: NormRect }[] {
  const pages = doc.getPages();
  const refs = pages.map((p) => p.ref);
  const out: { page: number; rect: NormRect }[] = [];

  let widgets: ReturnType<PDFField['acroField']['getWidgets']> = [];
  try {
    widgets = field.acroField.getWidgets();
  } catch {
    return out;
  }

  for (const widget of widgets) {
    let pageIndex = -1;
    try {
      const ref = widget.P();
      if (ref) pageIndex = refs.findIndex((r) => r === ref);
    } catch {
      pageIndex = -1;
    }
    if (pageIndex < 0) continue;

    const page = pages[pageIndex];
    const box = page.getMediaBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const view = renderedSize(box.width, box.height, rotation);

    let r: { x: number; y: number; width: number; height: number };
    try {
      r = widget.getRectangle();
    } catch {
      continue;
    }

    // PDF space (y up, absolute) → rendered space (y down, normalised).
    const x0 = r.x - box.x;
    const y0 = r.y - box.y;
    const corners = [
      pdfPointToVisual(x0, y0, box.width, box.height, rotation),
      pdfPointToVisual(x0 + r.width, y0 + r.height, box.width, box.height, rotation),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    out.push({
      page: pageIndex,
      rect: {
        x: Math.min(...xs) / view.width,
        y: Math.min(...ys) / view.height,
        width: Math.abs(xs[1] - xs[0]) / view.width,
        height: Math.abs(ys[1] - ys[0]) / view.height,
      },
    });
  }

  return out;
}

/** Inverse of visualPointToPdf — PDF user space to rendered pixels. */
function pdfPointToVisual(x: number, y: number, w: number, h: number, rotation: number) {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return { x: y, y: x };
    case 180: return { x: w - x, y: y };
    case 270: return { x: h - y, y: w - x };
    default: return { x, y: h - y };
  }
}

export async function inspectForm(file: File): Promise<{ fields: FormFieldInfo[]; hasXFA: boolean }> {
  const doc = await loadPdf(file);
  const form = doc.getForm();
  const hasXFA = (() => { try { return form.hasXFA(); } catch { return false; } })();

  const fields = form.getFields().map<FormFieldInfo>((field) => {
    const kind = kindOf(field);
    let value = '';
    let values: string[] = [];
    let options: string[] = [];
    let multiline = false;
    let maxLength: number | undefined;

    try {
      if (field instanceof PDFTextField) {
        value = field.getText() ?? '';
        multiline = field.isMultiline();
        maxLength = field.getMaxLength();
      } else if (field instanceof PDFCheckBox) {
        value = field.isChecked() ? 'true' : 'false';
      } else if (field instanceof PDFDropdown) {
        options = field.getOptions();
        values = field.getSelected();
        value = values[0] ?? '';
      } else if (field instanceof PDFOptionList) {
        options = field.getOptions();
        values = field.getSelected();
        value = values[0] ?? '';
      } else if (field instanceof PDFRadioGroup) {
        options = field.getOptions();
        value = field.getSelected() ?? '';
        values = value ? [value] : [];
      }
    } catch {
      // A malformed field should not hide the rest of the form.
    }

    const rects = widgetRects(doc, field);
    return {
      name: field.getName(),
      kind,
      value,
      values,
      options,
      required: (() => { try { return field.isRequired(); } catch { return false; } })(),
      readOnly: (() => { try { return field.isReadOnly(); } catch { return false; } })(),
      multiline,
      maxLength,
      page: rects[0]?.page ?? -1,
      rects,
    };
  });

  return { fields, hasXFA };
}

export interface FillOptions {
  /** Bake values into the page content and drop the interactive layer. */
  flatten: boolean;
  /** Recompute widget appearances so viewers show the new values. */
  updateAppearances: boolean;
}

export async function fillForm(
  file: File,
  values: Record<string, string | string[] | boolean>,
  options: FillOptions
): Promise<ToolOutput> {
  const doc = await loadPdf(file);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const problems: string[] = [];

  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    try {
      if (field instanceof PDFTextField) {
        field.setText(typeof value === 'string' ? value : String(value ?? ''));
      } else if (field instanceof PDFCheckBox) {
        const on = value === true || value === 'true' || value === 'on' || value === 'yes';
        if (on) field.check(); else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        const list = Array.isArray(value) ? value : [String(value)];
        const valid = list.filter(Boolean);
        if (valid.length === 0) field.clear();
        else field.select(field.isMultiselect() ? valid : valid[0]);
      } else if (field instanceof PDFOptionList) {
        const list = (Array.isArray(value) ? value : [String(value)]).filter(Boolean);
        if (list.length === 0) field.clear();
        else field.select(list);
      } else if (field instanceof PDFRadioGroup) {
        const selected = Array.isArray(value) ? value[0] : String(value);
        if (!selected) field.clear();
        else field.select(selected);
      }
    } catch (err) {
      problems.push(`${name}: ${err instanceof Error ? err.message : 'could not be set'}`);
    }
  }

  if (options.updateAppearances || options.flatten) {
    try {
      form.updateFieldAppearances(font);
    } catch {
      // Some producers ship appearances we cannot regenerate; keep the values.
    }
  }

  if (options.flatten) {
    try {
      form.flatten();
    } catch (err) {
      throw new Error(
        `This form could not be flattened (${err instanceof Error ? err.message : 'unsupported field'}). Uncheck "flatten" to keep it fillable.`
      );
    }
  }

  if (problems.length > 0 && problems.length === Object.keys(values).length) {
    throw new Error(problems[0]);
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-filled.pdf` };
}

// ---------- authoring ----------

export interface NewFieldSpec {
  id: string;
  kind: 'text' | 'checkbox' | 'dropdown' | 'radio';
  name: string;
  page: number;
  rect: NormRect;
  /** Dropdown / radio choices, one per line in the UI. */
  options: string[];
  required: boolean;
  multiline: boolean;
  fontSize: number;
}

/**
 * pdf-lib builds a widget by rotating {x, y, width, height} around (x, y), the
 * same way drawRectangle works — so the anchor is the *visual* bottom-left of
 * the box and the sizes stay in visual units.
 */
function placeField(
  page: PDFPage,
  rect: NormRect
): { x: number; y: number; width: number; height: number; rotate: number } {
  const box = page.getMediaBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const view = renderedSize(box.width, box.height, rotation);
  const anchor = visualPointToPdf(rect.x, rect.y + rect.height, box.width, box.height, rotation);
  return {
    x: box.x + anchor.x,
    y: box.y + anchor.y,
    width: rect.width * view.width,
    height: rect.height * view.height,
    rotate: rotation,
  };
}

export async function createFormFields(file: File, specs: NewFieldSpec[]): Promise<ToolOutput> {
  if (specs.length === 0) throw new Error('Draw at least one field on the page');

  const doc = await loadPdf(file);
  const form = doc.getForm();
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const used = new Set(form.getFields().map((f) => f.getName()));

  for (const spec of specs) {
    const page = pages[spec.page];
    if (!page) continue;

    let name = spec.name.trim() || `${spec.kind}_${used.size + 1}`;
    name = name.replace(/[.\s]+/g, '_');
    while (used.has(name)) name = `${name}_1`;
    used.add(name);

    const geom = placeField(page, spec.rect);
    const appearance = {
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      rotate: degrees(geom.rotate),
      borderColor: rgb(0.35, 0.4, 0.5),
      borderWidth: 1,
      backgroundColor: rgb(0.96, 0.97, 1),
      font,
    };

    if (spec.kind === 'text') {
      const field = form.createTextField(name);
      if (spec.multiline) field.enableMultiline();
      if (spec.required) field.enableRequired();
      // The default-appearance string only exists once a widget has been added.
      field.addToPage(page, appearance);
      field.setFontSize(spec.fontSize);
    } else if (spec.kind === 'checkbox') {
      const field = form.createCheckBox(name);
      if (spec.required) field.enableRequired();
      const side = Math.min(geom.width, geom.height);
      field.addToPage(page, { ...appearance, width: side, height: side });
    } else if (spec.kind === 'dropdown') {
      const field = form.createDropdown(name);
      field.setOptions(spec.options.length ? spec.options : ['Option 1', 'Option 2']);
      if (spec.required) field.enableRequired();
      field.addToPage(page, appearance);
      field.setFontSize(spec.fontSize);
    } else {
      const field = form.createRadioGroup(name);
      const choices = spec.options.length ? spec.options : ['Yes', 'No'];
      const slot = spec.rect.width / choices.length;
      choices.forEach((choice, i) => {
        // Split the drawn box into one square per choice, in visual space, so
        // the row still reads left-to-right on rotated pages.
        const sub = placeField(page, {
          x: spec.rect.x + slot * i,
          y: spec.rect.y,
          width: slot,
          height: spec.rect.height,
        });
        const side = Math.min(sub.width, sub.height, 18);
        field.addOptionToPage(choice, page, { ...appearance, x: sub.x, y: sub.y, width: side, height: side });
      });
      if (spec.required) field.enableRequired();
    }
  }

  try {
    form.updateFieldAppearances(font);
  } catch {
    // Appearances are regenerated by the viewer if we cannot build them here.
  }

  const bytes = await doc.save();
  return { blob: toBlob(bytes), name: `${baseName(file)}-fillable.pdf` };
}

// ---------- data export ----------

export function formDataToJSON(fields: FormFieldInfo[]): string {
  const out: Record<string, string | string[] | boolean> = {};
  for (const f of fields) {
    if (f.kind === 'checkbox') out[f.name] = f.value === 'true';
    else if (f.kind === 'optionlist') out[f.name] = f.values;
    else out[f.name] = f.value;
  }
  return JSON.stringify(out, null, 2);
}

export function formDataToCSV(fields: FormFieldInfo[]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['field', 'type', 'value'].map(escape).join(',')];
  for (const f of fields) {
    rows.push([f.name, f.kind, f.kind === 'optionlist' ? f.values.join('; ') : f.value].map(escape).join(','));
  }
  return rows.join('\n');
}
