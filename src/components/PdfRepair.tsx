'use client';

import React, { useCallback, useState } from 'react';
import {
  DEFAULT_REPAIR_OPTIONS,
  analyzePDF,
  repairPDF,
  type Diagnostics,
  type RepairOptions,
  type RepairResult,
} from '@/lib/pdf-repair';
import { formatFileSize } from '@/lib/converters';
import {
  Dropzone, FileBar, ErrorBox, WarningBox, PrimaryButton, ResultPanel, Section,
  Toggle, Slider, ProgressBar, downloadBlob,
} from './pdf/shared';

const METHOD_LABEL: Record<RepairResult['method'], string> = {
  rewrite: 'Rebuilt structure',
  trim: 'Trimmed junk + rebuilt structure',
  'rebuild-xref': 'Reconstructed cross-reference table',
  rasterize: 'Recovered pages as images',
};

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {ok
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />}
        </svg>
      </span>
      <span className="min-w-0">
        <span className="text-sm text-slate-700 block">{label}</span>
        {detail && <span className="text-xs text-slate-400">{detail}</span>}
      </span>
    </div>
  );
}

export default function PdfRepair() {
  const [file, setFile] = useState<File | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [options, setOptions] = useState<RepairOptions>(DEFAULT_REPAIR_OPTIONS);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepairResult | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
    setDiagnostics(null);
    setScanning(true);
    try {
      setDiagnostics(await analyzePDF(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be inspected.');
    } finally {
      setScanning(false);
    }
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      setResult(await repairPDF(file, options, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be repaired');
    } finally {
      setBusy(false);
    }
  }, [file, options]);

  const reset = useCallback(() => {
    setFile(null);
    setDiagnostics(null);
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  if (!file) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Upload the damaged PDF</h2>
        <Dropzone
          onFiles={handleFile}
          accept=".pdf,application/pdf,application/octet-stream"
          title="Drop a broken PDF here"
          hint="Files that will not open elsewhere are exactly what this is for"
        />
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-6">
        <ResultPanel
          title="Repair finished"
          name={result.name}
          size={result.blob.size}
          onDownload={() => downloadBlob(result.blob, result.name)}
          onReset={reset}
          resetLabel="Repair another file"
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Method', value: METHOD_LABEL[result.method] },
              { label: 'Pages recovered', value: String(result.pages) },
              { label: 'Size change', value: `${formatFileSize(file.size)} → ${formatFileSize(result.blob.size)}` },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-xs font-bold text-slate-800 leading-snug">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </ResultPanel>

        <Section title="Repair log">
          <ul className="space-y-2">
            {result.log.map((entry, i) => (
              <li key={i} className="text-sm text-slate-600 flex gap-2">
                <span className="text-slate-300 shrink-0 tabular-nums">{i + 1}.</span>
                <span>{entry}</span>
              </li>
            ))}
          </ul>
          {result.method === 'rasterize' && (
            <div className="mt-4">
              <WarningBox items={['The structure was beyond repair, so the readable pages were recovered as images. The output has no selectable text — run OCR on it if you need searchable text back.']} />
            </div>
          )}
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FileBar file={file} onChange={reset} />

      <Section title="Diagnostics" hint={scanning ? 'Inspecting the file…' : 'What the structural scan found'}>
        {scanning ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <span className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
            Scanning file structure…
          </div>
        ) : diagnostics ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-slate-100">
              <div>
                <Check ok={diagnostics.headerFound} label="PDF header" detail={diagnostics.headerFound ? `Version ${diagnostics.version ?? '?'}${diagnostics.headerOffset ? ` · ${diagnostics.headerOffset} junk bytes before it` : ''}` : 'No %PDF- marker'} />
                <Check ok={diagnostics.eofFound} label="End-of-file marker" detail={diagnostics.eofFound ? 'Present' : 'Missing — file is truncated'} />
                <Check ok={diagnostics.startxrefFound} label="Cross-reference pointer" detail={diagnostics.startxrefFound ? 'Present' : 'Missing'} />
                <Check ok={diagnostics.catalogFound} label="Document catalog" detail={diagnostics.catalogFound ? 'Found' : 'Not found'} />
              </div>
              <div>
                <Check ok={diagnostics.objectsFound > 0} label="Objects recoverable" detail={`${diagnostics.objectsFound} found by scanning`} />
                <Check ok={diagnostics.strictParse} label="Strict parse" detail={diagnostics.strictParse ? 'Opens normally' : 'Fails — needs rebuilding'} />
                <Check ok={diagnostics.lenientParse} label="Lenient parse" detail={diagnostics.lenientParse ? `${diagnostics.pageCount ?? '?'} pages readable` : 'Cannot be rendered'} />
                <Check ok={!diagnostics.encrypted} label="Unencrypted" detail={diagnostics.encrypted ? 'Encryption dictionary present' : 'No encryption'} />
              </div>
            </div>
            {diagnostics.notes.length > 0 && <WarningBox title="Findings" items={diagnostics.notes} />}
            {diagnostics.strictParse && diagnostics.lenientParse && diagnostics.notes.length === 0 && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                This file already parses cleanly. Repairing it will still normalise the cross-reference table and strip stale data.
              </p>
            )}
          </div>
        ) : null}
      </Section>

      <Section title="Recovery options">
        <div className="space-y-4">
          <Toggle
            checked={options.removeEncryption}
            onChange={(v) => setOptions((p) => ({ ...p, removeEncryption: v }))}
            label="Drop encryption if the file opens without a password"
          />
          <Toggle
            checked={options.allowRasterSalvage}
            onChange={(v) => setOptions((p) => ({ ...p, allowRasterSalvage: v }))}
            label="Allow page recovery as a last resort"
            hint="If the structure cannot be rebuilt, re-render every readable page into a fresh document"
          />
          {options.allowRasterSalvage && (
            <Slider
              label="Page recovery resolution"
              value={options.dpi}
              min={96}
              max={300}
              step={24}
              suffix=" DPI"
              onChange={(v) => setOptions((p) => ({ ...p, dpi: v }))}
            />
          )}
        </div>
      </Section>

      <ErrorBox message={error} />
      {busy && <ProgressBar value={progress} label="Repairing" />}

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy} disabled={scanning}>Repair PDF</PrimaryButton>
      </div>
    </div>
  );
}
