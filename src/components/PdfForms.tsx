'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  createFormFields,
  fillForm,
  formDataToCSV,
  formDataToJSON,
  inspectForm,
  type FormFieldInfo,
  type NewFieldSpec,
} from '@/lib/pdf-forms';
import { getPageGeometry } from '@/lib/pdf-render';
import {
  Dropzone, FileBar, ErrorBox, WarningBox, PrimaryButton, ResultPanel, Section, Field,
  SegmentedControl, Toggle, PageStage, PageNavigator, inputClass, downloadBlob,
} from './pdf/shared';

type Mode = 'fill' | 'create';
type NewKind = NewFieldSpec['kind'];

let seq = 0;
const nextId = () => `f-${++seq}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function PdfForms() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('fill');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [hasXFA, setHasXFA] = useState(false);
  const [values, setValues] = useState<Record<string, string | string[] | boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [specs, setSpecs] = useState<NewFieldSpec[]>([]);
  const [activeSpec, setActiveSpec] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<NewKind>('text');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const draft = useRef<{ id: string; startX: number; startY: number } | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setPage(0);
    setFields([]);
    setValues({});
    setSpecs([]);
    setLoading(true);
    try {
      const geometry = await getPageGeometry(next);
      setPageCount(geometry.length);
      const inspection = await inspectForm(next);
      setFields(inspection.fields);
      setHasXFA(inspection.hasXFA);
      setValues(
        Object.fromEntries(
          inspection.fields.map((f) => [
            f.name,
            f.kind === 'checkbox' ? f.value === 'true' : f.kind === 'optionlist' ? f.values : f.value,
          ])
        )
      );
      setMode(inspection.fields.length > 0 ? 'fill' : 'create');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This PDF could not be read.');
    } finally {
      setLoading(false);
    }
  }, []);

  const pointOf = useCallback((event: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (mode !== 'create') return;
    const point = pointOf(event);
    if (!point) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const id = nextId();
    draft.current = { id, startX: point.x, startY: point.y };
    setSpecs((prev) => [
      ...prev,
      {
        id,
        kind: newKind,
        name: `${newKind}_${prev.length + 1}`,
        page,
        rect: { x: point.x, y: point.y, width: 0, height: 0 },
        options: newKind === 'dropdown' ? ['Option 1', 'Option 2'] : newKind === 'radio' ? ['Yes', 'No'] : [],
        required: false,
        multiline: false,
        fontSize: 11,
      },
    ]);
    setActiveSpec(id);
  }, [mode, pointOf, newKind, page]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const current = draft.current;
    if (!current) return;
    const point = pointOf(event);
    if (!point) return;
    setSpecs((prev) =>
      prev.map((s) =>
        s.id === current.id
          ? {
              ...s,
              rect: {
                x: Math.min(current.startX, point.x),
                y: Math.min(current.startY, point.y),
                width: Math.abs(point.x - current.startX),
                height: Math.abs(point.y - current.startY),
              },
            }
          : s
      )
    );
  }, [pointOf]);

  const onPointerUp = useCallback(() => {
    const current = draft.current;
    draft.current = null;
    if (!current) return;
    setSpecs((prev) => prev.filter((s) => s.id !== current.id || (s.rect.width > 0.01 && s.rect.height > 0.008)));
  }, []);

  const patchSpec = useCallback((id: string, changes: Partial<NewFieldSpec>) => {
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }, []);

  const runFill = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await fillForm(file, values, { flatten, updateAppearances: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fill this form');
    } finally {
      setBusy(false);
    }
  }, [file, values, flatten]);

  const runCreate = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await createFormFields(file, specs));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add fields to this PDF');
    } finally {
      setBusy(false);
    }
  }, [file, specs]);

  const reset = useCallback(() => {
    setFile(null);
    setFields([]);
    setValues({});
    setSpecs([]);
    setResult(null);
    setError(null);
    setPage(0);
    setPageCount(0);
  }, []);

  const fieldsOnPage = useMemo(() => fields.filter((f) => f.rects.some((r) => r.page === page)), [fields, page]);
  const specsOnPage = useMemo(() => specs.filter((s) => s.page === page), [specs, page]);
  const active = useMemo(() => specs.find((s) => s.id === activeSpec) ?? null, [specs, activeSpec]);

  if (!file) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Upload PDF</h2>
        <Dropzone onFiles={handleFile} />
      </div>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title={mode === 'fill' ? (flatten ? 'Form filled and flattened' : 'Form filled') : 'Fillable PDF created'}
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={reset}
        resetLabel="Work on another PDF"
      />
    );
  }

  const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

  return (
    <div className="space-y-8">
      <FileBar
        file={file}
        detail={loading ? 'Scanning for fields…' : `${pageCount || '…'} pages · ${fields.length} existing field${fields.length === 1 ? '' : 's'}`}
        onChange={reset}
      />

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'fill', label: `Fill form${fields.length ? ` (${fields.length})` : ''}` },
          { value: 'create', label: 'Create fields' },
        ]}
      />

      {hasXFA && (
        <WarningBox
          title="XFA form detected"
          items={['This document uses Adobe XFA. Only the AcroForm layer can be read here, so some fields may be missing or read-only.']}
        />
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col items-center gap-4">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`relative w-full max-w-xl ${mode === 'create' ? 'cursor-crosshair touch-none' : ''}`}
          >
            <PageStage
              file={file}
              pageIndex={page}
              scale={1.5}
              overlay={
                <div className="absolute inset-0 pointer-events-none">
                  {mode === 'fill' &&
                    fieldsOnPage.flatMap((f) =>
                      f.rects
                        .filter((r) => r.page === page)
                        .map((r, i) => (
                          <div
                            key={`${f.name}-${i}`}
                            className="absolute ring-2 ring-blue-400/80 bg-blue-400/15 rounded-[2px]"
                            style={{ left: pct(r.rect.x), top: pct(r.rect.y), width: pct(r.rect.width), height: pct(r.rect.height) }}
                            title={f.name}
                          />
                        ))
                    )}
                  {mode === 'create' &&
                    specsOnPage.map((s) => (
                      <div
                        key={s.id}
                        className={`absolute rounded-[2px] ${s.id === activeSpec ? 'ring-2 ring-emerald-500 bg-emerald-400/20' : 'ring-2 ring-emerald-400/70 bg-emerald-400/10'}`}
                        style={{ left: pct(s.rect.x), top: pct(s.rect.y), width: pct(s.rect.width), height: pct(s.rect.height) }}
                      >
                        <span className="absolute -top-5 left-0 text-[10px] font-semibold text-emerald-700 bg-white/90 px-1 rounded">
                          {s.name}
                        </span>
                      </div>
                    ))}
                </div>
              }
            />
          </div>
          <PageNavigator page={page} total={pageCount || 1} onChange={setPage} />
        </div>

        <div className="space-y-5">
          {mode === 'fill' ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Field values</h3>
              {fields.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {loading ? 'Scanning…' : 'No interactive fields in this PDF. Switch to “Create fields” to make it fillable.'}
                </p>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {fields.map((f) => {
                    const value = values[f.name];
                    const badge = `${f.kind}${f.required ? ' · required' : ''}${f.readOnly ? ' · read-only' : ''}${f.page >= 0 ? ` · p${f.page + 1}` : ''}`;
                    return (
                      <div key={f.name} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 truncate">{f.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{badge}</span>
                        </div>
                        {f.kind === 'checkbox' ? (
                          <Toggle
                            checked={value === true}
                            onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                            label="Checked"
                          />
                        ) : f.kind === 'dropdown' || f.kind === 'radio' ? (
                          <select
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                            disabled={f.readOnly}
                            className={inputClass}
                          >
                            <option value="">— none —</option>
                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.kind === 'optionlist' ? (
                          <select
                            multiple
                            value={Array.isArray(value) ? value : []}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [f.name]: Array.from(e.target.selectedOptions, (o) => o.value),
                              }))
                            }
                            className={`${inputClass} h-24`}
                          >
                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.kind === 'signature' || f.kind === 'button' ? (
                          <p className="text-xs text-slate-400">Not editable here.</p>
                        ) : f.multiline ? (
                          <textarea
                            rows={3}
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                            disabled={f.readOnly}
                            className={inputClass}
                          />
                        ) : (
                          <input
                            value={typeof value === 'string' ? value : ''}
                            maxLength={f.maxLength}
                            onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                            disabled={f.readOnly}
                            className={inputClass}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {fields.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <Toggle
                    checked={flatten}
                    onChange={setFlatten}
                    label="Flatten after filling"
                    hint="Bakes the values into the page so they can no longer be changed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadBlob(new Blob([formDataToJSON(fields)], { type: 'application/json' }), `${file.name.replace(/\.pdf$/i, '')}-fields.json`)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => downloadBlob(new Blob([formDataToCSV(fields)], { type: 'text/csv' }), `${file.name.replace(/\.pdf$/i, '')}-fields.csv`)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">New field</h3>
              <SegmentedControl
                value={newKind}
                onChange={setNewKind}
                size="sm"
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'checkbox', label: 'Checkbox' },
                  { value: 'dropdown', label: 'Dropdown' },
                  { value: 'radio', label: 'Radio' },
                ]}
              />
              <p className="text-xs text-slate-500">Drag on the page to place a {newKind} field.</p>

              {active && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <Field label="Field name">
                    <input value={active.name} onChange={(e) => patchSpec(active.id, { name: e.target.value })} className={inputClass} />
                  </Field>
                  {(active.kind === 'dropdown' || active.kind === 'radio') && (
                    <Field label="Choices" hint="One per line">
                      <textarea
                        rows={4}
                        value={active.options.join('\n')}
                        onChange={(e) => patchSpec(active.id, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                        className={inputClass}
                      />
                    </Field>
                  )}
                  {active.kind === 'text' && (
                    <Toggle checked={active.multiline} onChange={(v) => patchSpec(active.id, { multiline: v })} label="Multi-line" />
                  )}
                  <Toggle checked={active.required} onChange={(v) => patchSpec(active.id, { required: v })} label="Required" />
                  <button
                    onClick={() => { setSpecs((prev) => prev.filter((s) => s.id !== active.id)); setActiveSpec(null); }}
                    className="w-full py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold"
                  >
                    Delete field
                  </button>
                </div>
              )}

              {specs.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">{specs.length} field{specs.length === 1 ? '' : 's'} placed</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {specs.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => { setPage(s.page); setActiveSpec(s.id); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium ${s.id === activeSpec ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          {s.name} · {s.kind} · p{s.page + 1}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ErrorBox message={error} />

      <Section title={mode === 'fill' ? 'Save filled form' : 'Save fillable PDF'}>
        {mode === 'fill' ? (
          <PrimaryButton onClick={runFill} busy={busy} disabled={fields.length === 0}>
            {flatten ? 'Fill and flatten' : 'Fill form'}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={runCreate} busy={busy} disabled={specs.length === 0}>
            Create {specs.length || ''} field{specs.length === 1 ? '' : 's'}
          </PrimaryButton>
        )}
      </Section>
    </div>
  );
}
