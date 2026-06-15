'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ToolOutput, ProgressFn } from '@/lib/pdf-tools';

export interface UsePdfToolOptions {
  toolType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>;
}

async function runTool(
  toolType: string,
  files: File[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<string, any>,
  onProgress: ProgressFn
): Promise<ToolOutput | ToolOutput[]> {
  const tools = await import('@/lib/pdf-tools');

  switch (toolType) {
    case 'merge':
      return tools.mergePDFs(files, onProgress);
    case 'split':
      return tools.splitPDF(files[0], options.mode ?? 'selected', options.pages ?? [], onProgress);
    case 'compress':
      return tools.compressPDF(files[0], options.level ?? 'medium', onProgress);
    case 'pdf-to-jpg':
    case 'pdf-to-png':
      return tools.pdfToImages(files[0], options.format ?? 'jpeg', options.dpi ?? 150, onProgress);
    case 'jpg-to-pdf':
      return tools.imagesToPDF(files, {
        pageSize: options.pageSize ?? 'A4',
        orientation: options.orientation ?? 'portrait',
        fitMode: options.fitMode ?? 'contain',
      }, onProgress);
    case 'rotate':
      return tools.rotatePDF(files[0], options.angle ?? 90, options.pages);
    case 'delete-pages':
      return tools.deletePages(files[0], options.pages ?? []);
    case 'reorder':
      return tools.reorderPages(files[0], options.order ?? []);
    case 'extract':
      return tools.extractPages(files[0], options.pages ?? []);
    case 'watermark':
      return tools.watermarkPDF(files[0], {
        text: options.text,
        opacity: options.opacity ?? 0.5,
        rotation: options.rotation ?? 0,
        position: options.position ?? 'center',
        size: options.size ?? 50,
      }, files[1]);
    case 'protect':
      return tools.protectPDF(files[0], options.password ?? '', options.permissions ?? {
        printing: true, modifying: false, copying: false, annotating: false,
      });
    case 'unlock':
      return tools.unlockPDF(files[0], options.password ?? '');
    case 'sign':
      return tools.signPDF(files[0], {
        signatureType: options.signatureType ?? 'type',
        signatureData: options.signatureData ?? '',
        page: options.page,
        position: options.position,
      });
    case 'metadata':
      return tools.setPDFMetadata(files[0], options);
    case 'ocr': {
      const { runOCR } = await import('@/lib/ocr');
      return runOCR(files[0], options.language ?? 'eng', options.outputFormat ?? 'searchable-pdf', onProgress);
    }
    case 'scan-to-pdf': {
      const { scanToPDF } = await import('@/lib/ocr');
      return scanToPDF(files, {
        grayscale: options.grayscale ?? true,
        brightness: options.brightness ?? 0,
        autoDetect: options.autoDetect ?? true,
      }, onProgress);
    }
    default:
      throw new Error(`Unknown tool: ${toolType}`);
  }
}

async function zipOutputs(outputs: ToolOutput[], zipName: string): Promise<ToolOutput> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const out of outputs) {
    zip.file(out.name, out.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, name: zipName };
}

export function usePdfTool({ toolType, options = {} }: UsePdfToolOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => releaseUrl, [releaseUrl]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = useCallback(async (files: File[], overrides?: Record<string, any>) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      const merged = overrides ? { ...options, ...overrides } : options;
      const output = await runTool(toolType, files, merged, (p) => setProgress(Math.min(100, p)));

      let final: ToolOutput;
      if (Array.isArray(output)) {
        if (output.length === 0) throw new Error('No output produced');
        final = output.length === 1
          ? output[0]
          : await zipOutputs(output, `${files[0].name.replace(/\.[^.]+$/, '')}-${toolType}.zip`);
      } else {
        final = output;
      }

      releaseUrl();
      const url = URL.createObjectURL(final.blob);
      urlRef.current = url;
      setProgress(100);
      setResult({ url, name: final.name, size: final.blob.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolType, JSON.stringify(options), releaseUrl]);

  const download = useCallback(async () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  const reset = useCallback(() => {
    releaseUrl();
    setIsProcessing(false);
    setProgress(0);
    setResult(null);
    setError(null);
  }, [releaseUrl]);

  return {
    isProcessing,
    progress,
    result,
    error,
    process,
    download,
    reset,
  };
}
