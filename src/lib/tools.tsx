import React from 'react';
import { accessForSlug, type ToolAccess } from './tool-access';

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function icon(path: React.ReactNode) {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      {path}
    </svg>
  );
}

const p = (d: string) => <path strokeLinecap="round" strokeLinejoin="round" d={d} />;

export const ICONS = {
  image: icon(p('M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z')),
  pdf: icon(p('M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z')),
  json: icon(p('M8 4H7a2 2 0 00-2 2v3a2 2 0 01-2 2 2 2 0 012 2v3a2 2 0 002 2h1m8-16h1a2 2 0 012 2v3a2 2 0 002 2 2 2 0 00-2 2v3a2 2 0 01-2 2h-1')),
  video: icon(p('M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z')),
  swap: icon(p('M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4')),
  compress: icon(p('M20 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2m16 8v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2M4 12h16')),
  resize: icon(p('M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4')),
  merge: icon(p('M7 4v6a4 4 0 004 4h6m0 0l-3-3m3 3l-3 3M7 14v6')),
  split: icon(p('M7 20v-6a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3M7 10V4')),
  pages: icon(p('M8 4h9a2 2 0 012 2v9M6 8h9a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9a2 2 0 012-2z')),
  rotate: icon(p('M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15')),
  trash: icon(p('M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16')),
  crop: icon(p('M6 2v14a2 2 0 002 2h14M6 6h12a2 2 0 012 2v12M2 6h4')),
  organize: icon(p('M4 6h16M4 10h16M4 14h10M4 18h10')),
  edit: icon(p('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z')),
  sign: icon(p('M3 17c3.5 0 3.5-10 7-10s3.5 10 7 10c1.5 0 2.5-1 3-2M3 21h18')),
  watermark: icon(p('M12 3l6 6a6 6 0 11-12 0l6-6z')),
  lock: icon(p('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z')),
  unlock: icon(p('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0')),
  redact: icon(p('M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21')),
  form: icon(p('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z')),
  compare: icon(p('M9 3v18m6-18v18M3 7h4m10 0h4M3 17h4m10 0h4')),
  repair: icon(p('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z')),
  ocr: icon(p('M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2M8 10h8M8 14h5')),
  scan: icon(p('M3 8V6a2 2 0 012-2h2M3 16v2a2 2 0 002 2h2m10-16h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M3 12h18')),
  archive: icon(p('M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4')),
  markdown: icon(p('M4 6h16v12H4z M7 15V9l2.5 3L12 9v6m4-6v6m0 0l-2-2m2 2l2-2')),
  code: icon(p('M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4')),
  check: icon(p('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z')),
  minify: icon(p('M20 12H4m4-4L4 12l4 4m8-8l4 4-4 4')),
  table: icon(p('M3 10h18M3 14h18M9 6v12M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z')),
  yaml: icon(p('M4 6h16M4 12h10M4 18h7m6-2l3-3 3 3')),
  diff: icon(p('M12 5v6m3-3H9m-3 9h12M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z')),
  ts: icon(p('M4 6h16M4 12h16M4 18h9')),
  escape: icon(p('M8 5l-5 7 5 7m8-14l5 7-5 7M14 4l-4 16')),
  path: icon(p('M4 6h4v4H4zM16 14h4v4h-4zM8 8h4a4 4 0 014 4v4')),
  sort: icon(p('M3 4h13M3 8h9M3 12h5m5 8V4m0 16l4-4m-4 4l-4-4')),
  link: icon(p('M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m4.5-4.5l1.5-1.5a4 4 0 015.656 5.656l-3 3')),
  word: icon(p('M9 12l1.5 5L12 12l1.5 5L15 12M6 3h9l5 5v13H6z')),
  excel: icon(p('M9 12l6 5m0-5l-6 5M6 3h9l5 5v13H6z')),
  ppt: icon(p('M10 17v-5h2.5a2.5 2.5 0 010 5H10zM6 3h9l5 5v13H6z')),
  html: icon(p('M4 4h16l-1.5 16L12 22l-6.5-2L4 4zm4 4h8l-.5 4H9l.25 3 2.75.8 2.75-.8.2-2')),
  download: icon(p('M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3')),
  youtube: icon(p('M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2 26 26 0 002 12a26 26 0 00.4 4.8 2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8A26 26 0 0022 12a26 26 0 00-.4-4.8zM10 15V9l5 3-5 3z')),
  facebook: icon(p('M14 8h3V4h-3a4 4 0 00-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8a1 1 0 011-1z')),
  instagram: icon(p('M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5-1h.01')),
  x: icon(p('M4 4l16 16M20 4L4 20')),
  spark: icon(p('M13 10V3L4 14h7v7l9-11h-7z')),
  shield: icon(p('M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8.5-7 9.9C8 20.5 5 16.5 5 12V7l7-4z')),
  bolt: icon(p('M13 10V3L4 14h7v7l9-11h-7z')),
} as const;

export type IconKey = keyof typeof ICONS;

/* ------------------------------------------------------------------ */
/* Departments                                                         */
/* ------------------------------------------------------------------ */

export type DeptId = 'image' | 'pdf' | 'json' | 'video';

export interface Department {
  id: DeptId;
  name: string;
  short: string;
  href: string;
  tagline: string;
  description: string;
  icon: IconKey;
  /* tailwind tokens, written out in full so the JIT keeps them */
  text: string;
  bg: string;
  ring: string;
  dot: string;
  gradient: string;
  hoverText: string;
}

export const DEPARTMENTS: Record<DeptId, Department> = {
  image: {
    id: 'image',
    name: 'Image Tools',
    short: 'Image',
    href: '/image',
    tagline: 'Convert, compress, resize',
    description: 'HEIC, JPEG, PNG and WebP conversion plus compression and resizing — all decoded in your browser.',
    icon: 'image',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
    hoverText: 'group-hover:text-emerald-600',
  },
  pdf: {
    id: 'pdf',
    name: 'PDF Tools',
    short: 'PDF',
    href: '/pdf',
    tagline: 'Merge, edit, sign, secure',
    description: 'A complete PDF suite — organize pages, convert to and from Office formats, sign, redact and repair.',
    icon: 'pdf',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    gradient: 'from-blue-500 to-indigo-500',
    hoverText: 'group-hover:text-blue-600',
  },
  json: {
    id: 'json',
    name: 'JSON Tools',
    short: 'JSON',
    href: '/json',
    tagline: 'Format, validate, convert',
    description: 'Pretty print, validate, diff and convert JSON to CSV, YAML or TypeScript types instantly.',
    icon: 'json',
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    ring: 'ring-violet-200',
    dot: 'bg-violet-500',
    gradient: 'from-violet-500 to-fuchsia-500',
    hoverText: 'group-hover:text-violet-600',
  },
  video: {
    id: 'video',
    name: 'Video Tools',
    short: 'Video',
    href: '/video-tools',
    tagline: 'Download video and audio',
    description: 'Save videos from YouTube, Facebook, Instagram and X as MP4, or pull the audio out as MP3.',
    icon: 'video',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    gradient: 'from-amber-500 to-orange-500',
    hoverText: 'group-hover:text-amber-600',
  },
};

export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export interface Tool {
  label: string;
  href: string;
  description: string;
  /** short line used inside the mega menu, where space is tight */
  short: string;
  dept: DeptId;
  group: string;
  icon: IconKey;
  keywords?: string[];
  badge?: 'New' | 'Popular';
  /** 'pro' tools need any paid plan; derived from PRO_TOOL_SLUGS */
  access: ToolAccess;
}

/** Entries are written without `access`; it is applied once, below. */
const TOOL_ENTRIES: Omit<Tool, 'access'>[] = [
  /* ---------------------------- image ---------------------------- */
  {
    label: 'Image Converter', href: '/image/convert', dept: 'image', group: 'Convert', icon: 'swap',
    short: 'Any format to any format',
    description: 'Convert between HEIC, JPEG, PNG and WebP in bulk, then download everything as a ZIP.',
    keywords: ['heic', 'jpg', 'jpeg', 'png', 'webp', 'batch'], badge: 'Popular',
  },
  {
    label: 'HEIC to JPEG', href: '/image/heic-to-jpeg', dept: 'image', group: 'Convert', icon: 'image',
    short: 'iPhone photos to JPEG',
    description: 'Turn Apple HEIC/HEIF photos into universally supported JPEG files, one at a time or in bulk.',
    keywords: ['iphone', 'heif', 'apple'], badge: 'Popular',
  },
  {
    label: 'HEIC to PNG', href: '/image/heic-to-png', dept: 'image', group: 'Convert', icon: 'image',
    short: 'iPhone photos to lossless PNG',
    description: 'Convert Apple HEIC/HEIF photos to lossless PNG with full quality retained.',
    keywords: ['iphone', 'heif', 'lossless'],
  },
  {
    label: 'PNG to WebP', href: '/image/png-to-webp', dept: 'image', group: 'Convert', icon: 'image',
    short: 'Lossless WebP with alpha',
    description: 'Convert PNG to WebP with a lossless mode and full alpha transparency preserved.',
    keywords: ['transparency', 'alpha', 'lossless'],
  },
  {
    label: 'JPEG to WebP', href: '/image/jpeg-to-webp', dept: 'image', group: 'Convert', icon: 'image',
    short: 'Photos 25–35% smaller',
    description: 'Convert JPG/JPEG photos to high-quality WebP — typically 25–35% smaller at the same quality.',
    keywords: ['jpg', 'smaller', 'web'],
  },
  {
    label: 'Image Compressor', href: '/image/compress', dept: 'image', group: 'Optimize', icon: 'compress',
    short: 'Shrink files, keep quality',
    description: 'Reduce image file size while keeping it visually identical, with a live before/after comparison.',
    keywords: ['shrink', 'optimize', 'size'], badge: 'Popular',
  },
  {
    label: 'Image Resizer', href: '/image/resize', dept: 'image', group: 'Optimize', icon: 'resize',
    short: 'Presets for social and email',
    description: 'Change dimensions freely or use presets for social media, email and thumbnails.',
    keywords: ['dimensions', 'scale', 'crop', 'thumbnail'],
  },

  /* ----------------------------- pdf ----------------------------- */
  {
    label: 'Merge PDFs', href: '/pdf/merge', dept: 'pdf', group: 'Organize', icon: 'merge',
    short: 'Combine files into one',
    description: 'Combine multiple PDF files into a single document and drag them into the order you want.',
    keywords: ['combine', 'join'], badge: 'Popular',
  },
  {
    label: 'Split PDF', href: '/pdf/split', dept: 'pdf', group: 'Organize', icon: 'split',
    short: 'Pull pages into new files',
    description: 'Split a PDF into separate documents, picking pages from a thumbnail preview.',
    keywords: ['separate', 'divide'], badge: 'Popular',
  },
  {
    label: 'Delete Pages', href: '/pdf/delete-pages', dept: 'pdf', group: 'Organize', icon: 'trash',
    short: 'Remove unwanted pages',
    description: 'Remove pages from a PDF with a visual preview of what is being dropped.',
    keywords: ['remove'],
  },
  {
    label: 'Reorder Pages', href: '/pdf/reorder', dept: 'pdf', group: 'Organize', icon: 'pages',
    short: 'Drag thumbnails to sort',
    description: 'Rearrange the pages of a PDF by dragging and dropping thumbnails.',
    keywords: ['rearrange', 'move', 'sort'],
  },
  {
    label: 'Extract Pages', href: '/pdf/extract', dept: 'pdf', group: 'Organize', icon: 'pages',
    short: 'Selected pages to new PDF',
    description: 'Pull specific pages out of a PDF into a brand new document.',
    keywords: ['copy', 'subset'],
  },
  {
    label: 'Organize PDF', href: '/pdf/organize', dept: 'pdf', group: 'Organize', icon: 'organize',
    short: 'One page manager for all',
    description: 'Sort, rotate, duplicate, delete and insert pages from a single page manager.',
    keywords: ['manage', 'arrange'],
  },
  {
    label: 'Rotate PDF', href: '/pdf/rotate', dept: 'pdf', group: 'Organize', icon: 'rotate',
    short: '90°, 180° or 270°',
    description: 'Rotate one page or every page in a PDF by 90°, 180° or 270°.',
    keywords: ['turn', 'orientation'],
  },
  {
    label: 'Crop PDF', href: '/pdf/crop', dept: 'pdf', group: 'Organize', icon: 'crop',
    short: 'Trim margins or an area',
    description: 'Trim white margins automatically or crop pages to a selected area.',
    keywords: ['trim', 'margin'],
  },

  {
    label: 'PDF to Images', href: '/pdf/to-images', dept: 'pdf', group: 'Convert from PDF', icon: 'image',
    short: 'Pages as JPG or PNG',
    description: 'Render PDF pages to high-quality JPG or PNG images for sharing or embedding.',
    keywords: ['jpg', 'png', 'export'], badge: 'Popular',
  },
  {
    label: 'PDF to Word', href: '/pdf/to-word', dept: 'pdf', group: 'Convert from PDF', icon: 'word',
    short: 'Editable DOCX',
    description: 'Convert a PDF into an editable Word DOCX file with the text layout preserved.',
    keywords: ['docx', 'office'], badge: 'Popular',
  },
  {
    label: 'PDF to Excel', href: '/pdf/to-excel', dept: 'pdf', group: 'Convert from PDF', icon: 'excel',
    short: 'Text and tables to XLSX',
    description: 'Extract text and tables from a PDF into an Excel XLSX spreadsheet.',
    keywords: ['xlsx', 'spreadsheet', 'table'],
  },
  {
    label: 'PDF to PowerPoint', href: '/pdf/to-powerpoint', dept: 'pdf', group: 'Convert from PDF', icon: 'ppt',
    short: 'Pages become slides',
    description: 'Convert PDF pages into PPTX slides ready to present or edit.',
    keywords: ['pptx', 'slides'],
  },
  {
    label: 'PDF to Markdown', href: '/pdf/to-markdown', dept: 'pdf', group: 'Convert from PDF', icon: 'markdown',
    short: 'Clean Markdown text',
    description: 'Convert PDF text into Markdown with headings, lists and tables preserved.',
    keywords: ['md', 'text'],
  },
  {
    label: 'PDF to PDF/A', href: '/pdf/to-pdfa', dept: 'pdf', group: 'Convert from PDF', icon: 'archive',
    short: 'ISO archival standard',
    description: 'Convert to the PDF/A archival standard with an embedded sRGB output intent.',
    keywords: ['archive', 'iso', 'long term'],
  },

  {
    label: 'Images to PDF', href: '/pdf/from-images', dept: 'pdf', group: 'Convert to PDF', icon: 'image',
    short: 'Photos into one document',
    description: 'Combine JPG, PNG, WebP or HEIC images into a single PDF with custom ordering.',
    keywords: ['jpg', 'photo', 'combine'], badge: 'Popular',
  },
  {
    label: 'Word to PDF', href: '/pdf/from-word', dept: 'pdf', group: 'Convert to PDF', icon: 'word',
    short: 'DOCX to PDF',
    description: 'Turn a Word DOCX document into a clean, paginated PDF.',
    keywords: ['docx', 'office'],
  },
  {
    label: 'Excel to PDF', href: '/pdf/from-excel', dept: 'pdf', group: 'Convert to PDF', icon: 'excel',
    short: 'XLSX sheets to PDF',
    description: 'Convert Excel XLSX sheets into a printable PDF with the table layout kept intact.',
    keywords: ['xlsx', 'spreadsheet'],
  },
  {
    label: 'PowerPoint to PDF', href: '/pdf/from-powerpoint', dept: 'pdf', group: 'Convert to PDF', icon: 'ppt',
    short: 'Slides to PDF pages',
    description: 'Convert a PPTX deck into a PDF, one slide per page.',
    keywords: ['pptx', 'slides'],
  },
  {
    label: 'HTML to PDF', href: '/pdf/from-html', dept: 'pdf', group: 'Convert to PDF', icon: 'html',
    short: 'Web page or raw HTML',
    description: 'Convert a live web page, pasted HTML or an .html file into a paginated PDF.',
    keywords: ['web', 'url', 'page'],
  },
  {
    label: 'Scan to PDF', href: '/pdf/scan', dept: 'pdf', group: 'Convert to PDF', icon: 'scan',
    short: 'Photo scans with cleanup',
    description: 'Turn document photos into clean scans with edge enhancement and OCR text extraction.',
    keywords: ['camera', 'document', 'ocr'],
  },

  {
    label: 'Edit PDF', href: '/pdf/edit', dept: 'pdf', group: 'Edit & Sign', icon: 'edit',
    short: 'Text, images, shapes, ink',
    description: 'Add text, images, shapes, highlights and freehand drawings to any page.',
    keywords: ['annotate', 'draw', 'markup'], badge: 'Popular',
  },
  {
    label: 'Sign PDF', href: '/pdf/sign', dept: 'pdf', group: 'Edit & Sign', icon: 'sign',
    short: 'Draw, type or upload',
    description: 'Sign a document by drawing, typing or uploading your signature, then place it anywhere.',
    keywords: ['signature', 'esign'], badge: 'Popular',
  },
  {
    label: 'Watermark PDF', href: '/pdf/watermark', dept: 'pdf', group: 'Edit & Sign', icon: 'watermark',
    short: 'Text or image stamps',
    description: 'Stamp text or an image across pages with custom opacity, rotation and position.',
    keywords: ['stamp', 'brand'],
  },
  {
    label: 'Page Numbers', href: '/pdf/page-numbers', dept: 'pdf', group: 'Edit & Sign', icon: 'pages',
    short: 'Full typographic control',
    description: 'Add page numbers with custom position, format, numerals and typography.',
    keywords: ['numbering', 'footer'],
  },
  {
    label: 'PDF Forms', href: '/pdf/forms', dept: 'pdf', group: 'Edit & Sign', icon: 'form',
    short: 'Fill or build fields',
    description: 'Detect and fill AcroForm fields, or draw brand new fillable fields onto a PDF.',
    keywords: ['acroform', 'fillable', 'field'],
  },
  {
    label: 'PDF Metadata', href: '/pdf/metadata', dept: 'pdf', group: 'Edit & Sign', icon: 'form',
    short: 'Title, author, keywords',
    description: 'Edit PDF metadata: title, author, subject, keywords and creation date.',
    keywords: ['properties', 'info'],
  },

  {
    label: 'Protect PDF', href: '/pdf/protect', dept: 'pdf', group: 'Secure', icon: 'lock',
    short: 'Password + permissions',
    description: 'Password-protect a PDF with AES-256 encryption and fine-grained permission controls.',
    keywords: ['password', 'encrypt', 'aes'],
  },
  {
    label: 'Unlock PDF', href: '/pdf/unlock', dept: 'pdf', group: 'Secure', icon: 'unlock',
    short: 'Strip a known password',
    description: 'Remove password protection from a PDF once you have authenticated with the password.',
    keywords: ['decrypt', 'remove password'],
  },
  {
    label: 'Redact PDF', href: '/pdf/redact', dept: 'pdf', group: 'Secure', icon: 'redact',
    short: 'Delete content for real',
    description: 'Permanently remove sensitive text and graphics instead of just drawing a box over them.',
    keywords: ['censor', 'black out', 'privacy'],
  },

  {
    label: 'Compress PDF', href: '/pdf/compress', dept: 'pdf', group: 'Optimize & Fix', icon: 'compress',
    short: 'Smaller, same document',
    description: 'Reduce PDF file size by optimizing internal structure without losing document quality.',
    keywords: ['shrink', 'size'], badge: 'Popular',
  },
  {
    label: 'OCR PDF', href: '/pdf/ocr', dept: 'pdf', group: 'Optimize & Fix', icon: 'ocr',
    short: 'Make scans searchable',
    description: 'Extract text from scanned PDFs and images in many languages, and build a searchable PDF.',
    keywords: ['text recognition', 'tesseract', 'searchable'],
  },
  {
    label: 'Compare PDF', href: '/pdf/compare', dept: 'pdf', group: 'Optimize & Fix', icon: 'compare',
    short: 'Pixel and word diff',
    description: 'Compare two PDFs with a pixel difference overlay plus a word-level text diff.',
    keywords: ['diff', 'versions'],
  },
  {
    label: 'Repair PDF', href: '/pdf/repair', dept: 'pdf', group: 'Optimize & Fix', icon: 'repair',
    short: 'Recover broken files',
    description: 'Diagnose and recover damaged, truncated or unreadable PDF files.',
    keywords: ['fix', 'corrupt', 'recover'],
  },

  /* ----------------------------- json ---------------------------- */
  {
    label: 'JSON Formatter', href: '/json/format', dept: 'json', group: 'Read & Check', icon: 'code',
    short: 'Pretty print + tree view',
    description: 'Pretty print JSON with syntax highlighting and a collapsible tree for deep exploration.',
    keywords: ['beautify', 'pretty', 'indent'], badge: 'Popular',
  },
  {
    label: 'JSON Validator', href: '/json/validate', dept: 'json', group: 'Read & Check', icon: 'check',
    short: 'Line-level error reports',
    description: 'Check JSON syntax with precise line-level error reporting and instant feedback.',
    keywords: ['lint', 'syntax', 'error'],
  },
  {
    label: 'JSON Diff', href: '/json/diff', dept: 'json', group: 'Read & Check', icon: 'diff',
    short: 'Side-by-side compare',
    description: 'Compare two JSON documents side by side with colour-coded inline differences.',
    keywords: ['compare', 'changes'],
  },
  {
    label: 'JSONPath Eval', href: '/json/jsonpath', dept: 'json', group: 'Read & Check', icon: 'path',
    short: 'Query with JSONPath',
    description: 'Query and filter JSON using JSONPath expressions with a live match count.',
    keywords: ['query', 'filter', 'select'],
  },
  {
    label: 'JSON ↔ CSV', href: '/json/csv', dept: 'json', group: 'Convert', icon: 'table',
    short: 'Arrays to tables, both ways',
    description: 'Convert JSON arrays into CSV tables and parse CSV data back into structured JSON.',
    keywords: ['spreadsheet', 'excel', 'table'],
  },
  {
    label: 'JSON ↔ YAML', href: '/json/yaml', dept: 'json', group: 'Convert', icon: 'yaml',
    short: 'For Docker, K8s, CI',
    description: 'Convert between JSON and YAML — handy for Docker, Kubernetes and CI config files.',
    keywords: ['kubernetes', 'docker', 'config'],
  },
  {
    label: 'TS Interface Gen', href: '/json/ts-interface', dept: 'json', group: 'Convert', icon: 'ts',
    short: 'Types straight from JSON',
    description: 'Generate TypeScript interfaces or type aliases automatically from any JSON structure.',
    keywords: ['typescript', 'types', 'interface'], badge: 'Popular',
  },
  {
    label: 'JSON URL Params', href: '/json/url-params', dept: 'json', group: 'Convert', icon: 'link',
    short: 'Query strings, both ways',
    description: 'Convert between JSON objects and URL query parameter strings with proper encoding.',
    keywords: ['query string', 'encode'],
  },
  {
    label: 'JSON Minifier', href: '/json/minify', dept: 'json', group: 'Transform', icon: 'minify',
    short: 'Strip whitespace',
    description: 'Compress JSON by removing whitespace and see the exact before/after size saving.',
    keywords: ['compress', 'small'],
  },
  {
    label: 'JSON Escape', href: '/json/escape', dept: 'json', group: 'Transform', icon: 'escape',
    short: 'Escape and unescape',
    description: 'Escape special characters for JSON strings, or unescape them back to raw text.',
    keywords: ['unescape', 'string'],
  },
  {
    label: 'JSON Sort Keys', href: '/json/sort', dept: 'json', group: 'Transform', icon: 'sort',
    short: 'Alphabetical, recursive',
    description: 'Recursively sort object keys alphabetically so diffs stay small and predictable.',
    keywords: ['order', 'alphabetical'],
  },

  /* ---------------------------- video ---------------------------- */
  {
    label: 'Video Downloader', href: '/video', dept: 'video', group: 'Universal', icon: 'download',
    short: 'Paste any supported link',
    description: 'Paste a link from YouTube, Facebook, Instagram or X and download the video or its audio.',
    keywords: ['universal', 'link', 'mp4', 'mp3'], badge: 'Popular',
  },
  {
    label: 'YouTube Downloader', href: '/video-tools/youtube', dept: 'video', group: 'By platform', icon: 'youtube',
    short: 'MP4 video or MP3 audio',
    description: 'Save YouTube videos and Shorts as MP4, or pull the audio out as MP3.',
    keywords: ['shorts', 'mp3', 'mp4'], badge: 'Popular',
  },
  {
    label: 'Facebook Downloader', href: '/video-tools/facebook', dept: 'video', group: 'By platform', icon: 'facebook',
    short: 'Videos, Reels and Watch',
    description: 'Save public Facebook videos, Reels and Watch clips as MP4.',
    keywords: ['reels', 'fb'],
  },
  {
    label: 'Instagram Downloader', href: '/video-tools/instagram', dept: 'video', group: 'By platform', icon: 'instagram',
    short: 'Reels, feed and IGTV',
    description: 'Save public Instagram Reels, feed videos and IGTV clips as MP4.',
    keywords: ['reels', 'igtv', 'ig'],
  },
  {
    label: 'X (Twitter) Downloader', href: '/video-tools/x', dept: 'video', group: 'By platform', icon: 'x',
    short: 'Videos and GIFs from posts',
    description: 'Save videos and GIFs from public posts on X (Twitter) as MP4.',
    keywords: ['twitter', 'gif'],
  },
];

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Which tools are paid-only lives in tool-access.ts, keyed by href, so server
 * code and the entitlement layer can read it without importing this JSX module.
 */
export const TOOLS: Tool[] = TOOL_ENTRIES.map((tool) => ({
  ...tool,
  access: accessForSlug(tool.href),
}));

export const TOOL_COUNT = TOOLS.length;

export const FREE_TOOLS = TOOLS.filter((t) => t.access === 'free');
export const PRO_TOOLS = TOOLS.filter((t) => t.access === 'pro');
export const FREE_TOOL_COUNT = FREE_TOOLS.length;

export function toolByHref(href: string): Tool | undefined {
  return TOOLS.find((t) => t.href === href);
}

export function toolsByDept(dept: DeptId): Tool[] {
  return TOOLS.filter((t) => t.dept === dept);
}

export function deptCount(dept: DeptId): number {
  return toolsByDept(dept).length;
}

export interface ToolGroup {
  name: string;
  tools: Tool[];
}

/** Tools of a department, bucketed into their menu groups, order preserved. */
export function groupedTools(dept: DeptId): ToolGroup[] {
  const groups: ToolGroup[] = [];
  for (const tool of toolsByDept(dept)) {
    let group = groups.find((g) => g.name === tool.group);
    if (!group) {
      group = { name: tool.group, tools: [] };
      groups.push(group);
    }
    group.tools.push(tool);
  }
  return groups;
}

export const POPULAR_TOOLS = TOOLS.filter((t) => t.badge === 'Popular');

export function searchTools(query: string, dept?: DeptId | 'all'): Tool[] {
  const pool = !dept || dept === 'all' ? TOOLS : toolsByDept(dept);
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const terms = q.split(/\s+/);
  return pool.filter((tool) => {
    const haystack = [
      tool.label,
      tool.description,
      tool.short,
      tool.group,
      tool.dept,
      DEPARTMENTS[tool.dept].name,
      tool.href,
      ...(tool.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
