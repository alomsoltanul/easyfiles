// High-quality WebP encoding pipeline.
// Kept separate from converters.ts because that path mattes every image onto a
// white background (fine for HEIC/JPEG, destroys PNG alpha) and decodes through
// a data URL, which doubles peak memory on large files.

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export interface WebpOptions {
  /** 0..1 — ignored when lossless is set */
  quality: number;
  /** Encode without loss. Chromium maps toBlob quality 1.0 to lossless WebP. */
  lossless?: boolean;
  /** Cap on the longest edge; undefined keeps original dimensions */
  maxDimension?: number;
  /** Keep the alpha channel instead of flattening onto `background` */
  preserveTransparency?: boolean;
  /** Matte colour used when transparency is flattened */
  background?: string;
}

export interface WebpResult {
  blob: Blob;
  width: number;
  height: number;
  hadAlpha: boolean;
}

let webpEncodeSupport: boolean | null = null;

/** Feature-detects canvas WebP encoding once per session. */
export function supportsWebpEncode(): boolean {
  if (!isBrowser) return false;
  if (webpEncodeSupport !== null) return webpEncodeSupport;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  webpEncodeSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  return webpEncodeSupport;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image applies the EXIF orientation JPEGs carry, so portrait photos
      // don't come out sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari < 17 rejects the options bag — fall through to the <img> path.
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

function makeCanvas(width: number, height: number, alpha: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha });
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/**
 * Halves the image repeatedly until one more halving would overshoot the target,
 * then does the final resample. A single large downscale step drops detail and
 * aliases hard edges; stepped halving keeps text and line art readable.
 */
function drawResampled(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  alpha: boolean,
  background: string
) {
  let current: CanvasImageSource = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (currentWidth / 2 >= targetWidth && currentHeight / 2 >= targetHeight && currentWidth > 2 && currentHeight > 2) {
    const halfWidth = Math.max(1, Math.round(currentWidth / 2));
    const halfHeight = Math.max(1, Math.round(currentHeight / 2));
    const step = makeCanvas(halfWidth, halfHeight, true);
    step.ctx.drawImage(current, 0, 0, halfWidth, halfHeight);
    current = step.canvas;
    currentWidth = halfWidth;
    currentHeight = halfHeight;
  }

  const { canvas, ctx } = makeCanvas(targetWidth, targetHeight, alpha);
  if (!alpha) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  ctx.drawImage(current, 0, 0, targetWidth, targetHeight);
  return { canvas, ctx };
}

/** Sampled scan for any non-opaque pixel — full scans are wasteful on big images. */
function detectAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    const step = Math.max(4, Math.floor(data.length / 4 / 20000) * 4);
    for (let i = 3; i < data.length; i += step) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    // Tainted canvas shouldn't happen for local files, but never fail the convert over it.
    return false;
  }
}

export async function convertToWebp(file: File, options: WebpOptions): Promise<WebpResult> {
  if (!isBrowser) throw new Error('WebP conversion requires a browser environment');
  if (!supportsWebpEncode()) throw new Error('This browser cannot encode WebP. Try Chrome, Edge, Firefox, or Safari 16+.');

  const source = await decode(file);
  const sourceWidth = 'width' in source ? (source.width as number) : 0;
  const sourceHeight = 'height' in source ? (source.height as number) : 0;
  if (!sourceWidth || !sourceHeight) throw new Error('Image has no readable dimensions');

  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;
  const cap = options.maxDimension;
  if (cap && Math.max(sourceWidth, sourceHeight) > cap) {
    const scale = cap / Math.max(sourceWidth, sourceHeight);
    targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  }

  const alpha = options.preserveTransparency !== false;
  const { canvas, ctx } = drawResampled(
    source,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    alpha,
    options.background || '#FFFFFF'
  );

  const hadAlpha = alpha ? detectAlpha(ctx, targetWidth, targetHeight) : false;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('WebP encoding failed'))),
      'image/webp',
      options.lossless ? 1 : Math.min(0.9999, Math.max(0.01, options.quality))
    );
  });

  if (blob.type !== 'image/webp') {
    throw new Error('This browser fell back to a non-WebP format. Try Chrome, Edge, or Firefox.');
  }

  if ('close' in source && typeof source.close === 'function') source.close();

  return { blob, width: targetWidth, height: targetHeight, hadAlpha };
}

export interface WebpBulkResult extends WebpResult {
  originalFile: File;
  fileName: string;
  originalSize: number;
  convertedSize: number;
}

export interface WebpBulkFailure {
  fileName: string;
  reason: string;
}

export async function convertBulkToWebp(
  files: File[],
  options: WebpOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<{ results: WebpBulkResult[]; failures: WebpBulkFailure[] }> {
  const results: WebpBulkResult[] = [];
  const failures: WebpBulkFailure[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const converted = await convertToWebp(file, options);
      results.push({
        ...converted,
        originalFile: file,
        fileName: `${file.name.replace(/\.[^/.]+$/, '')}.webp`,
        originalSize: file.size,
        convertedSize: converted.blob.size,
      });
    } catch (error) {
      failures.push({
        fileName: file.name,
        reason: error instanceof Error ? error.message : 'Conversion failed',
      });
    }
    onProgress?.(i + 1, files.length);
    // Yield so the progress bar repaints between files.
    await new Promise((r) => setTimeout(r, 0));
  }

  return { results, failures };
}
