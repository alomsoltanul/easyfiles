'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';

interface Tool {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
  department: string;
  route: string;
}

const DEPARTMENTS = {
  image: {
    name: 'Image Tools',
    color: 'emerald',
    description: 'Convert, compress, and resize images — all in your browser',
  },
  pdf: {
    name: 'PDF Tools',
    color: 'blue',
    description: 'Merge, split, compress, and transform PDF documents',
  },
  json: {
    name: 'JSON Tools',
    color: 'violet',
    description: 'Format, validate, convert, and manipulate JSON data',
  },
  video: {
    name: 'Video Tools',
    color: 'amber',
    description: 'Download videos and extract audio from popular platforms',
  },
} as const;

const SVG_IMAGE = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const SVG_PDF = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
const SVG_JSON = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
  </svg>
);
const SVG_VIDEO = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const ALL_TOOLS: Tool[] = [
  {
    label: 'Image Converter', href: '/image/convert', route: 'convert',
    description: 'Convert HEIC, JPEG, PNG, WebP — any format to any format with batch processing',
    icon: SVG_IMAGE, department: 'image',
  },
  {
    label: 'HEIC to PNG', href: '/image/heic-to-png', route: 'heic-to-png',
    description: 'Convert Apple HEIC/HEIF photos to lossless PNG — single or bulk processing',
    icon: SVG_IMAGE, department: 'image',
  },
  {
    label: 'HEIC to JPEG', href: '/image/heic-to-jpeg', route: 'heic-to-jpeg',
    description: 'Convert Apple HEIC/HEIF photos to JPEG — single or bulk processing',
    icon: SVG_IMAGE, department: 'image',
  },
  {
    label: 'Image Compressor', href: '/image/compress', route: 'compress',
    description: 'Reduce image file size while maintaining visual quality — WebP optimization',
    icon: SVG_IMAGE, department: 'image',
  },
  {
    label: 'Image Resizer', href: '/image/resize', route: 'resize',
    description: 'Change dimensions with preset sizes for social media, email, and thumbnails',
    icon: SVG_IMAGE, department: 'image',
  },
  {
    label: 'JSON Formatter', href: '/json/format', route: 'format',
    description: 'Pretty print JSON with syntax highlighting and collapsible tree view for deep exploration',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON Validator', href: '/json/validate', route: 'validate',
    description: 'Check JSON syntax with precise line-level error reporting and instant feedback',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON Minifier', href: '/json/minify', route: 'minify',
    description: 'Compress JSON by removing whitespace — see exact before/after size savings',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON ↔ CSV', href: '/json/csv', route: 'csv',
    description: 'Convert JSON arrays to CSV tables and parse CSV data back to structured JSON',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON ↔ YAML', href: '/json/yaml', route: 'yaml',
    description: 'Convert between JSON and YAML — perfect for Docker, K8s, and CI config files',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON Diff', href: '/json/diff', route: 'diff',
    description: 'Compare two JSON objects side by side with color-coded inline difference highlighting',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'TS Interface Gen', href: '/json/ts-interface', route: 'ts-interface',
    description: 'Generate TypeScript interfaces or type aliases automatically from JSON structures',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON Escape', href: '/json/escape', route: 'escape',
    description: 'Escape special characters for JSON strings or unescape them back to raw text',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSONPath Eval', href: '/json/jsonpath', route: 'jsonpath',
    description: 'Query and filter JSON data using JSONPath expressions with live match count',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON Sort Keys', href: '/json/sort', route: 'sort',
    description: 'Recursively sort JSON object keys alphabetically for consistent diffs',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'JSON URL Params', href: '/json/url-params', route: 'url-params',
    description: 'Convert between JSON objects and URL query parameter strings with encoding',
    icon: SVG_JSON, department: 'json',
  },
  {
    label: 'Merge PDFs', href: '/pdf/merge', route: 'merge',
    description: 'Combine multiple PDF files into a single document — drag to reorder pages',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Split PDF', href: '/pdf/split', route: 'split',
    description: 'Extract specific pages from a PDF — preview thumbnails for easy selection',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Compress PDF', href: '/pdf/compress', route: 'compress',
    description: 'Reduce PDF file size by optimizing structure without losing document quality',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'PDF to Images', href: '/pdf/to-images', route: 'to-images',
    description: 'Render PDF pages to high-quality JPG or PNG images for sharing or embedding',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Images to PDF', href: '/pdf/from-images', route: 'from-images',
    description: 'Combine multiple images into a single PDF document with custom ordering',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Scan to PDF', href: '/pdf/scan', route: 'scan',
    description: 'Scan document photos with image enhancement and Tesseract OCR text extraction',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'OCR PDF', href: '/pdf/ocr', route: 'ocr',
    description: 'Extract text from PDFs and images with multi-language support and create searchable PDFs',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Rotate PDF', href: '/pdf/rotate', route: 'rotate',
    description: 'Rotate individual pages or all pages in your PDF by 90°, 180°, or 270°',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Delete Pages', href: '/pdf/delete-pages', route: 'delete-pages',
    description: 'Remove unwanted pages from your PDF with visual preview',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Reorder Pages', href: '/pdf/reorder', route: 'reorder',
    description: 'Rearrange pages in your PDF by dragging and dropping thumbnails',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Extract Pages', href: '/pdf/extract', route: 'extract',
    description: 'Extract specific pages from your PDF into a new document',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Watermark PDF', href: '/pdf/watermark', route: 'watermark',
    description: 'Add text or image watermarks with custom opacity, rotation, and position',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Protect PDF', href: '/pdf/protect', route: 'protect',
    description: 'Password-protect your PDF with AES-256 encryption and permission controls',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Unlock PDF', href: '/pdf/unlock', route: 'unlock',
    description: 'Remove password protection from your PDF after valid authentication',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Sign PDF', href: '/pdf/sign', route: 'sign',
    description: 'Add your signature to PDF documents — draw, type, or upload',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'PDF Metadata', href: '/pdf/metadata', route: 'metadata',
    description: 'Edit PDF metadata including title, author, subject, keywords, and creation date',
    icon: SVG_PDF, department: 'pdf',
  },
  {
    label: 'Video Downloader', href: '/video', route: 'download',
    description: 'Download videos and audio from YouTube, Facebook, Instagram, X (Twitter)',
    icon: SVG_VIDEO, department: 'video',
  },
];

const routeIcons: Record<string, React.ReactNode> = {
  convert: SVG_IMAGE,
  'heic-to-png': SVG_IMAGE,
  'heic-to-jpeg': SVG_IMAGE,
  compress: SVG_IMAGE,
  resize: SVG_IMAGE,
  format: SVG_JSON,
  validate: SVG_JSON,
  minify: SVG_JSON,
  csv: SVG_JSON,
  yaml: SVG_JSON,
  diff: SVG_JSON,
  'ts-interface': SVG_JSON,
  escape: SVG_JSON,
  jsonpath: SVG_JSON,
  sort: SVG_JSON,
  'url-params': SVG_JSON,
  merge: SVG_PDF,
  split: SVG_PDF,
  'to-images': SVG_PDF,
  'from-images': SVG_PDF,
  scan: SVG_PDF,
  ocr: SVG_PDF,
  rotate: SVG_PDF,
  'delete-pages': SVG_PDF,
  reorder: SVG_PDF,
  extract: SVG_PDF,
  watermark: SVG_PDF,
  protect: SVG_PDF,
  unlock: SVG_PDF,
  sign: SVG_PDF,
  metadata: SVG_PDF,
  download: SVG_VIDEO,
};

interface ToolsDashboardProps {
  department?: string;
}

export default function ToolsDashboard({ department }: ToolsDashboardProps) {
  const [search, setSearch] = useState('');
  const [activeDept, setActiveDept] = useState<string>(department || 'all');
  const [prevDept, setPrevDept] = useState(department);
  const inputRef = useRef<HTMLInputElement>(null);

  if (prevDept !== department) {
    setPrevDept(department);
    setActiveDept(department || 'all');
  }

  const tools = useMemo(() => {
    let filtered = ALL_TOOLS;
    if (activeDept !== 'all') {
      filtered = filtered.filter((t) => t.department === activeDept);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.route.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [search, activeDept]);

  const departmentKeys = Object.keys(DEPARTMENTS) as (keyof typeof DEPARTMENTS)[];

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.1),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,currentColor_6px,currentColor_7px)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <div className="hero-rise">
            {!department ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">ConvertTools</h1>
                    <p className="text-base text-slate-400 font-medium">All-in-one daily tools — free, private, no uploads</p>
                  </div>
                </div>
                <p className="text-slate-400 text-base max-w-xl mb-6 leading-relaxed">
                  {ALL_TOOLS.length} powerful tools across image, PDF, JSON, and video — all processing happens directly in your browser.
                  Your files never leave your device.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {[`${ALL_TOOLS.length} tools`, '100% in-browser', 'No uploads', 'Free forever'].map((chip) => (
                    <span key={chip} className="inline-flex items-center gap-1.5 bg-white/10 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {chip}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  All Tools
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{DEPARTMENTS[activeDept as keyof typeof DEPARTMENTS]?.name}</h1>
                <p className="text-base text-slate-400 mt-2 max-w-xl">
                  {DEPARTMENTS[activeDept as keyof typeof DEPARTMENTS]?.description}
                </p>
              </>
            )}
          </div>

          {/* Search bar */}
          <div className="relative max-w-lg hero-rise hero-rise-delay">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all tools..."
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition-all duration-200"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Department tabs */}
      <div className="border-b border-slate-200 bg-white sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-3">
            <button
              onClick={() => setActiveDept('all')}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeDept === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Tools
            </button>
            {departmentKeys.map((key) => (
              <button
                key={key}
                onClick={() => setActiveDept(key)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeDept === key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {DEPARTMENTS[key].name.replace(' Tools', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tool cards grid */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        {tools.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No tools found</h3>
            <p className="text-sm text-slate-500">Try a different search term or category</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-6 font-medium">
              {tools.length} tool{tools.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool, i) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      tool.department === 'image' ? 'bg-emerald-50 text-emerald-600' :
                      tool.department === 'json' ? 'bg-violet-50 text-violet-600' :
                      tool.department === 'pdf' ? 'bg-blue-50 text-blue-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {routeIcons[tool.route]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          tool.department === 'image' ? 'bg-emerald-50 text-emerald-600' :
                          tool.department === 'json' ? 'bg-violet-50 text-violet-600' :
                          tool.department === 'pdf' ? 'bg-blue-50 text-blue-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {DEPARTMENTS[tool.department as keyof typeof DEPARTMENTS].name}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 self-center text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all duration-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
