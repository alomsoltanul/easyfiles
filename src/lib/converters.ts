// Check if code is running in browser
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

let heic2any: any = null;

const loadHeic2Any = async () => {
  if (!heic2any && isBrowser) {
    const module = await import('heic2any');
    heic2any = module.default;
  }
  return heic2any;
};

// Legacy type kept for backward compatibility
export type ConversionFormat = 'png-to-webp' | 'jpg-to-webp' | 'heic-to-webp';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ConversionResult {
  originalFile: File;
  convertedBlob: Blob;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
}

export interface ConversionOptions {
  quality: number;
  maxWidth?: number;
}

// Legacy functions for backward compat
export function getAcceptedTypes(format: ConversionFormat): string {
  switch (format) {
    case 'png-to-webp': return '.png,image/png';
    case 'jpg-to-webp': return '.jpg,.jpeg,image/jpeg,image/jpg';
    case 'heic-to-webp': return '.heic,.heif,image/heic,image/heif';
    default: return 'image/*';
  }
}

export function getFormatLabel(format: ConversionFormat): string {
  switch (format) {
    case 'png-to-webp': return 'PNG';
    case 'jpg-to-webp': return 'JPG / JPEG';
    case 'heic-to-webp': return 'HEIC';
    default: return 'Image';
  }
}

export function validateFileType(file: File, format: ConversionFormat): boolean {
  const name = file.name.toLowerCase();
  switch (format) {
    case 'png-to-webp':
      return file.type === 'image/png' || name.endsWith('.png');
    case 'jpg-to-webp':
      return file.type === 'image/jpeg' || file.type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
    case 'heic-to-webp':
      return file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
    default:
      return false;
  }
}

// New: validate any supported image type
export function validateImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) return true;
  if (file.type === 'image/jpeg' || file.type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) return true;
  if (file.type === 'image/png' || name.endsWith('.png')) return true;
  if (file.type === 'image/webp' || name.endsWith('.webp')) return true;
  return false;
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

// New bidirectional converter — replaces convertImageToWebp
export async function convertImage(
  file: File,
  targetFormat: OutputFormat,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!isBrowser) {
    throw new Error('Image conversion requires a browser environment');
  }

  try {
    const isHeic = file.type === 'image/heic' ||
                   file.type === 'image/heif' ||
                   file.name.toLowerCase().endsWith('.heic') ||
                   file.name.toLowerCase().endsWith('.heif');

    let sourceBlob: Blob;

    if (isHeic) {
      const converter = await loadHeic2Any();
      sourceBlob = await converter({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95,
      });
    } else {
      sourceBlob = file;
    }

    return await blobToFormat(sourceBlob, targetFormat, options);
  } catch (error) {
    console.error('Conversion error:', error);
    throw new Error('Failed to convert image. Please ensure it is a valid image file.');
  }
}

// Legacy wrapper — kept for backward compatibility
export async function convertImageToWebp(
  file: File,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  return convertImage(file, 'image/webp', options);
}

async function blobToFormat(
  blob: Blob,
  targetFormat: OutputFormat,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (options.maxWidth && img.width > options.maxWidth) {
          const scale = options.maxWidth / img.width;
          targetWidth = Math.round(img.width * scale);
          targetHeight = Math.round(img.height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (result) => {
            if (result) {
              resolve({ blob: result, width: targetWidth, height: targetHeight });
            } else {
              reject(new Error(`Failed to convert to ${targetFormat}`));
            }
          },
          targetFormat,
          options.quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

export async function convertBulkToFormat(
  files: File[],
  targetFormat: OutputFormat,
  options: ConversionOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const { blob, width, height } = await convertImage(file, targetFormat, options);
      results.push({
        originalFile: file,
        convertedBlob: blob,
        fileName: generateDownloadFileName(file.name, targetFormat),
        originalSize: file.size,
        convertedSize: blob.size,
        width,
        height,
      });
    } catch (error) {
      console.error(`Failed to convert ${file.name}:`, error);
    }

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}

// Legacy bulk convert
export async function convertBulkToWebP(
  files: File[],
  options: ConversionOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<ConversionResult[]> {
  return convertBulkToFormat(files, 'image/webp', options, onProgress);
}

export function generateDownloadFileName(originalName: string, targetFormat?: OutputFormat): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const ext = targetFormat ? getExtension(targetFormat) : '.webp';
  return `${baseName}${ext}`;
}

function getExtension(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
  }
}

export function downloadImage(blob: Blob, fileName: string): void {
  if (!isBrowser) {
    throw new Error('Download requires a browser environment');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
