'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  DEFAULT_HTML_OPTIONS,
  fetchPageHtml,
  htmlToPDF,
  prepareLocalHtml,
  type HtmlPageSize,
  type HtmlToPdfOptions,
} from '@/lib/html-to-pdf';
import {
  Dropzone, ErrorBox, WarningBox, PrimaryButton, ResultPanel, Section, Field,
  SegmentedControl, Toggle, Slider, ProgressBar, inputClass, downloadBlob,
} from './pdf/shared';

type Source = 'url' | 'code' | 'file';

const VIEWPORTS = [
  { value: 1440, label: 'Desktop 1440' },
  { value: 1280, label: 'Desktop 1280' },
  { value: 1024, label: 'Laptop 1024' },
  { value: 768, label: 'Tablet 768' },
  { value: 390, label: 'Mobile 390' },
];

export default function HtmlToPdf() {
  const [source, setSource] = useState<Source>('url');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [assets, setAssets] = useState(0);
  const [options, setOptions] = useState<HtmlToPdfOptions>(DEFAULT_HTML_OPTIONS);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const set = useCallback(<K extends keyof HtmlToPdfOptions>(key: K, value: HtmlToPdfOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadUrl = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError(null);
    setResult(null);
    try {
      const page = await fetchPageHtml(url);
      setHtml(page.html);
      setPageTitle(page.title || page.finalUrl);
      setAssets(page.assets);
      setFileName(`${(page.title || 'webpage').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'webpage'}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That page could not be loaded.');
    } finally {
      setFetching(false);
    }
  }, [url]);

  const loadCode = useCallback(() => {
    if (!code.trim()) return;
    setError(null);
    setResult(null);
    setHtml(prepareLocalHtml(code));
    setPageTitle('Pasted HTML');
    setAssets(0);
    setFileName('document.pdf');
  }, [code]);

  const loadFile = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setError(null);
    setResult(null);
    try {
      const text = await next.text();
      setHtml(prepareLocalHtml(text));
      setPageTitle(next.name);
      setAssets(0);
      setFileName(`${next.name.replace(/\.[^.]+$/, '')}.pdf`);
    } catch {
      setError('That file could not be read.');
    }
  }, []);

  const run = useCallback(async () => {
    if (!html) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      setResult(await htmlToPDF(html, options, fileName ?? 'webpage.pdf', setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not render this page');
    } finally {
      setBusy(false);
    }
  }, [html, options, fileName]);

  const reset = useCallback(() => {
    setHtml(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setPageTitle('');
    setAssets(0);
  }, []);

  if (result) {
    return (
      <ResultPanel
        title="PDF ready"
        name={result.name}
        size={result.blob.size}
        onDownload={() => downloadBlob(result.blob, result.name)}
        onReset={() => { reset(); setUrl(''); setCode(''); setFileName(null); }}
        resetLabel="Convert another page"
      />
    );
  }

  return (
    <div className="space-y-8">
      {!html ? (
        <>
          <SegmentedControl
            value={source}
            onChange={setSource}
            options={[
              { value: 'url', label: 'From URL' },
              { value: 'code', label: 'Paste HTML' },
              { value: 'file', label: 'Upload .html' },
            ]}
          />

          {source === 'url' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadUrl(); }}
                  placeholder="https://example.com/article"
                  className={inputClass}
                />
                <button
                  onClick={loadUrl}
                  disabled={fetching || !url.trim()}
                  className="shrink-0 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-bold"
                >
                  {fetching ? 'Loading…' : 'Load page'}
                </button>
              </div>
              <WarningBox
                items={[
                  'The page is fetched server-side and stripped of scripts, then rendered in a sandboxed frame in your browser. Sites that build their content with JavaScript, or that sit behind a login or paywall, will come through mostly empty.',
                ]}
              />
            </div>
          )}

          {source === 'code' && (
            <div className="space-y-3">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={12}
                placeholder={'<h1>Invoice</h1>\n<p>Paste any HTML — inline CSS is respected.</p>'}
                className={`${inputClass} font-mono text-xs`}
              />
              <button
                onClick={loadCode}
                disabled={!code.trim()}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-bold"
              >
                Use this HTML
              </button>
            </div>
          )}

          {source === 'file' && (
            <Dropzone
              onFiles={loadFile}
              accept=".html,.htm,text/html"
              title="Drop an .html file here"
              hint="Local stylesheets referenced by relative paths will not resolve"
            />
          )}

          <ErrorBox message={error} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{pageTitle}</p>
              <p className="text-xs text-slate-500">
                {(html.length / 1024).toFixed(0)} KB of markup
                {assets > 0 && ` · ${assets} sub-resources proxied`}
              </p>
            </div>
            <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">Change source</button>
          </div>

          <Section title="Preview" hint="This is exactly what gets rasterised">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <iframe
                ref={previewRef}
                title="Page preview"
                sandbox="allow-same-origin"
                srcDoc={html}
                className="w-full h-96 bg-white"
              />
            </div>
          </Section>

          <Section title="Page setup">
            <div className="space-y-4">
              <Field label="Page size">
                <SegmentedControl
                  value={options.pageSize}
                  onChange={(v) => set('pageSize', v as HtmlPageSize)}
                  size="sm"
                  options={[
                    { value: 'A4', label: 'A4' },
                    { value: 'Letter', label: 'Letter' },
                    { value: 'Legal', label: 'Legal' },
                    { value: 'A3', label: 'A3' },
                    { value: 'Fit', label: 'One tall page' },
                  ]}
                />
              </Field>

              {options.pageSize !== 'Fit' && (
                <Field label="Orientation">
                  <SegmentedControl
                    value={options.orientation}
                    onChange={(v) => set('orientation', v)}
                    size="sm"
                    options={[
                      { value: 'portrait', label: 'Portrait' },
                      { value: 'landscape', label: 'Landscape' },
                    ]}
                  />
                </Field>
              )}

              <Field label="Emulated viewport width">
                <select
                  value={options.viewportWidth}
                  onChange={(e) => set('viewportWidth', Number(e.target.value))}
                  className={inputClass}
                >
                  {VIEWPORTS.map((v) => <option key={v.value} value={v.value}>{v.label} px</option>)}
                </select>
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Slider label="Margin" value={options.margin} min={0} max={30} suffix=" mm" onChange={(v) => set('margin', v)} />
                <Slider label="Capture quality" value={options.scale} min={1} max={3} step={0.5} suffix="×" onChange={(v) => set('scale', v)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <Field label="Background colour">
                  <div className="flex gap-2 items-center">
                    <input type="color" value={options.background} onChange={(e) => set('background', e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                    <input value={options.background} onChange={(e) => set('background', e.target.value)} className={inputClass} />
                  </div>
                </Field>
                <Slider label="Settle delay" value={options.settleMs} min={0} max={3000} step={100} suffix=" ms" onChange={(v) => set('settleMs', v)} />
              </div>

              {options.pageSize !== 'Fit' && (
                <Toggle
                  checked={options.smartPageBreaks}
                  onChange={(v) => set('smartPageBreaks', v)}
                  label="Smart page breaks"
                  hint="Nudges each break to the nearest blank band so lines are not sliced in half"
                />
              )}
            </div>
          </Section>

          <ErrorBox message={error} />
          {busy && <ProgressBar value={progress} label="Rendering page" />}

          <div className="border-t border-slate-100 pt-6">
            <PrimaryButton onClick={run} busy={busy}>Convert to PDF</PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
