'use client';

/**
 * Logging helper for the image tools.
 *
 * They all end the same way — an array of results carrying originalSize and
 * convertedSize — so one call covers HEIC, format conversion, WebP, resize and
 * compression without each component repeating the arithmetic.
 */

import { currentSlug, logRun } from './usage';

interface SizedResult {
  originalSize: number;
  convertedSize: number;
}

export function logImageRun(results: SizedResult[], startedAt: number): void {
  if (results.length === 0) return;
  logRun({
    slug: currentSlug(),
    fileCount: results.length,
    inputBytes: results.reduce((sum, r) => sum + r.originalSize, 0),
    outputBytes: results.reduce((sum, r) => sum + r.convertedSize, 0),
    durationMs: Date.now() - startedAt,
    status: 'success',
  });
}

export function logImageFailure(fileCount: number, startedAt: number, message: string): void {
  logRun({
    slug: currentSlug(),
    fileCount,
    durationMs: Date.now() - startedAt,
    status: 'error',
    errorCode: message.slice(0, 64),
  });
}
