'use client';

import React, { useCallback, useState } from 'react';
import {
  DEFAULT_PDFA_OPTIONS,
  convertToPdfA,
  detectPdfA,
  type PdfAOptions,
  type PdfAPart,
  type PdfAResult,
} from '@/lib/pdf-a';
import {
  Dropzone, FileBar, ErrorBox, WarningBox, PrimaryButton, ResultPanel, Section, Field,
  SegmentedControl, Slider, ProgressBar, inputClass, downloadBlob,
} from './pdf/shared';

const PARTS: { value: PdfAPart; label: string; blurb: string }[] = [
  { value: '1b', label: 'PDF/A-1b', blurb: 'Strictest and most widely accepted. No transparency, no layers, no attachments.' },
  { value: '2b', label: 'PDF/A-2b', blurb: 'Recommended default. Allows transparency, layers and JPEG 2000.' },
  { value: '3b', label: 'PDF/A-3b', blurb: 'Same as A-2b but permits arbitrary embedded files (e-invoicing, ZUGFeRD).' },
];

export default function PdfToPdfA() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<PdfAOptions>(DEFAULT_PDFA_OPTIONS);
  const [existing, setExisting] = useState<{ isPdfA: boolean; part?: string; conformance?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfAResult | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setOptions((prev) => ({ ...prev, title: next.name.replace(/\.pdf$/i, '') }));
    try {
      setExisting(await detectPdfA(next));
    } catch {
      setExisting(null);
    }
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      setResult(await convertToPdfA(file, options, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert this PDF');
    } finally {
      setBusy(false);
    }
  }, [file, options]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setExisting(null);
    setProgress(0);
  }, []);

  if (!file) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Upload PDF</h2>
        <Dropzone onFiles={handleFile} />
      </div>
    );
  }

  if (result) {
    const missing = result.fonts.filter((f) => !f.embedded);
    return (
      <div className="space-y-6">
        <ResultPanel
          title={`PDF/A-${result.part.toUpperCase()} created`}
          name={result.name}
          size={result.blob.size}
          onDownload={() => downloadBlob(result.blob, result.name)}
          onReset={reset}
          resetLabel="Convert another PDF"
        >
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">What was written</p>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• sRGB IEC61966-2.1 output intent with an embedded ICC destination profile</li>
              <li>• XMP metadata declaring pdfaid:part {result.part[0]} / conformance B</li>
              <li>• Permanent file identifier in the trailer</li>
              <li>• JavaScript, open actions and additional actions removed</li>
              {result.mode === 'rasterize' && <li>• Every page re-rendered as an image, so no fonts are referenced at all</li>}
            </ul>
          </div>
        </ResultPanel>

        {result.warnings.length > 0 && <WarningBox title="Worth knowing" items={result.warnings} />}

        {result.fonts.length > 0 && (
          <Section title="Font audit" hint={`${result.fonts.length - missing.length} of ${result.fonts.length} fonts embedded`}>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {result.fonts.map((f) => (
                <div key={`${f.name}-${f.subtype}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{f.name}</p>
                    <p className="text-xs text-slate-400">{f.subtype}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded ${f.embedded ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {f.embedded ? 'Embedded' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FileBar file={file} onChange={reset} />

      {existing?.isPdfA && (
        <WarningBox
          title="Already declares PDF/A"
          items={[`This file claims PDF/A-${existing.part}${existing.conformance ?? ''} conformance. Converting again rewrites the output intent and metadata.`]}
        />
      )}

      <Section title="Conformance level">
        <div className="space-y-3">
          <SegmentedControl
            value={options.part}
            onChange={(v) => setOptions((p) => ({ ...p, part: v }))}
            options={PARTS.map((p) => ({ value: p.value, label: p.label }))}
          />
          <p className="text-sm text-slate-500">{PARTS.find((p) => p.value === options.part)?.blurb}</p>
        </div>
      </Section>

      <Section title="Conversion mode">
        <div className="space-y-4">
          <SegmentedControl
            value={options.mode}
            onChange={(v) => setOptions((p) => ({ ...p, mode: v }))}
            options={[
              { value: 'preserve', label: 'Preserve text' },
              { value: 'rasterize', label: 'Rasterize pages' },
            ]}
          />
          <p className="text-sm text-slate-500">
            {options.mode === 'preserve'
              ? 'Keeps text selectable and searchable. Conformance depends on the source embedding all of its fonts — the font audit below runs on conversion.'
              : 'Renders every page to an image first. Nothing depends on fonts or transparency afterwards, so the result always conforms — at the cost of searchable text.'}
          </p>
          {options.mode === 'rasterize' && (
            <Slider label="Resolution" value={options.dpi} min={120} max={400} step={20} suffix=" DPI" onChange={(v) => setOptions((p) => ({ ...p, dpi: v }))} />
          )}
        </div>
      </Section>

      <Section title="Archival metadata" hint="Written into both the document info dictionary and the XMP packet">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title">
            <input value={options.title} onChange={(e) => setOptions((p) => ({ ...p, title: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Author">
            <input value={options.author} onChange={(e) => setOptions((p) => ({ ...p, author: e.target.value }))} placeholder="Unknown" className={inputClass} />
          </Field>
        </div>
      </Section>

      <ErrorBox message={error} />
      {busy && <ProgressBar value={progress} label="Converting" />}

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy}>Convert to PDF/A-{options.part.toUpperCase()}</PrimaryButton>
      </div>
    </div>
  );
}
