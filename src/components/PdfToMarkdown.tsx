'use client';

import React, { useCallback, useState } from 'react';
import {
  DEFAULT_MARKDOWN_OPTIONS,
  pdfToMarkdown,
  type MarkdownOptions,
  type MarkdownResult,
} from '@/lib/pdf-markdown';
import {
  Dropzone, FileBar, ErrorBox, PrimaryButton, ResultPanel, Section, Toggle,
  ProgressBar, downloadBlob,
} from './pdf/shared';

export default function PdfToMarkdown() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<MarkdownOptions>(DEFAULT_MARKDOWN_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarkdownResult | null>(null);
  const [copied, setCopied] = useState(false);

  const set = useCallback(<K extends keyof MarkdownOptions>(key: K, value: MarkdownOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFile = useCallback((files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setResult(null);
    setError(null);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      setResult(await pdfToMarkdown(file, options, setProgress));
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
    setProgress(0);
    setCopied(false);
  }, []);

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Your browser blocked clipboard access — use the download button instead.');
    }
  }, [result]);

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
      <div className="space-y-6">
        <ResultPanel
          title="Markdown ready"
          name={result.name}
          size={result.blob.size}
          onDownload={() => downloadBlob(result.blob, result.name)}
          onReset={reset}
          resetLabel="Convert another PDF"
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pages', value: result.pages },
              { label: 'Words', value: result.words.toLocaleString() },
              { label: 'Images', value: result.images },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-lg font-bold text-slate-800 tabular-nums">{stat.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{stat.label}</p>
              </div>
            ))}
          </div>
        </ResultPanel>

        <Section title="Preview">
          <div className="space-y-3">
            <button
              onClick={copy}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <pre className="max-h-96 overflow-auto bg-slate-900 text-slate-100 text-xs leading-relaxed p-4 rounded-xl whitespace-pre-wrap break-words">
              {result.markdown.slice(0, 40000)}
              {result.markdown.length > 40000 ? '\n\n… preview truncated — download for the full document' : ''}
            </pre>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FileBar file={file} onChange={reset} />

      <Section title="Structure detection" hint="Turn these off for a plain, unstyled transcript">
        <div className="grid sm:grid-cols-2 gap-4">
          <Toggle checked={options.detectHeadings} onChange={(v) => set('detectHeadings', v)} label="Headings" hint="Larger and bolder lines become # headings" />
          <Toggle checked={options.detectLists} onChange={(v) => set('detectLists', v)} label="Lists" hint="Bullets and numbered runs become Markdown lists" />
          <Toggle checked={options.detectTables} onChange={(v) => set('detectTables', v)} label="Tables" hint="Column-aligned rows become Markdown tables" />
          <Toggle checked={options.detectEmphasis} onChange={(v) => set('detectEmphasis', v)} label="Bold and italic" hint="Reads the embedded font names" />
          <Toggle checked={options.mergeParagraphs} onChange={(v) => set('mergeParagraphs', v)} label="Rejoin wrapped lines" hint="Reflows hard-wrapped paragraphs" />
          <Toggle checked={options.pageBreaks} onChange={(v) => set('pageBreaks', v)} label="Page separators" hint="Adds --- between pages" />
        </div>
      </Section>

      <Section title="Images">
        <Toggle
          checked={options.extractImages}
          onChange={(v) => set('extractImages', v)}
          label="Extract embedded images"
          hint="Downloads a ZIP with the Markdown plus an images/ folder, linked from the text"
        />
      </Section>

      <ErrorBox message={error} />
      {busy && <ProgressBar value={progress} label="Reading pages" />}

      <div className="border-t border-slate-100 pt-6">
        <PrimaryButton onClick={run} busy={busy}>Convert to Markdown</PrimaryButton>
      </div>
    </div>
  );
}
