'use client';

import React, { useMemo, useState, useRef } from 'react';
import Link from 'next/link';

type CategoryKey =
  | 'workflows'
  | 'organize'
  | 'optimize'
  | 'convert'
  | 'edit'
  | 'security'
  | 'intelligence';

interface Category {
  key: CategoryKey;
  label: string;
  color: string;
  bg: string;
  text: string;
  ring: string;
}

const CATEGORIES: Category[] = [
  { key: 'workflows',   label: 'Workflows',       color: 'fuchsia', bg: 'bg-fuchsia-50',  text: 'text-fuchsia-700',  ring: 'ring-fuchsia-200' },
  { key: 'organize',    label: 'Organize PDF',    color: 'blue',    bg: 'bg-blue-50',     text: 'text-blue-700',     ring: 'ring-blue-200' },
  { key: 'optimize',    label: 'Optimize PDF',    color: 'emerald', bg: 'bg-emerald-50',  text: 'text-emerald-700',  ring: 'ring-emerald-200' },
  { key: 'convert',     label: 'Convert PDF',     color: 'amber',   bg: 'bg-amber-50',    text: 'text-amber-700',    ring: 'ring-amber-200' },
  { key: 'edit',        label: 'Edit PDF',        color: 'violet',  bg: 'bg-violet-50',   text: 'text-violet-700',   ring: 'ring-violet-200' },
  { key: 'security',    label: 'PDF Security',    color: 'rose',    bg: 'bg-rose-50',     text: 'text-rose-700',     ring: 'ring-rose-200' },
  { key: 'intelligence',label: 'PDF Intelligence',color: 'sky',     bg: 'bg-sky-50',      text: 'text-sky-700',      ring: 'ring-sky-200' },
];

interface Tool {
  label: string;
  href: string;
  description: string;
  category: CategoryKey;
  icon: React.ReactNode;
  comingSoon?: boolean;
  isNew?: boolean;
}

const iconClass = 'w-6 h-6';

const ICONS: Record<string, React.ReactNode> = {
  merge: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 5H5a2 2 0 00-2 2v3m0 4v3a2 2 0 002 2h3m8-14h3a2 2 0 012 2v3m0 4v3a2 2 0 01-2 2h-3M12 8v8m-4-4h8" />
    </svg>
  ),
  split: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3v4a1 1 0 001 1h6a1 1 0 001-1V3m-4 12v6M9 21h6M4 12h16" />
    </svg>
  ),
  compress: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2m5-4h6" />
    </svg>
  ),
  'to-images': (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4-4 3 3 5-5 4 4M4 6h16v12H4z" />
    </svg>
  ),
  'from-images': (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h10v10H4z M8 8h10v10H8z" />
    </svg>
  ),
  scan: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" />
    </svg>
  ),
  ocr: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8h10M7 12h6m-6 4h10M4 4h16v16H4z" />
      <circle cx="17" cy="16" r="2.5" strokeWidth={1.5} />
    </svg>
  ),
  rotate: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M5 10a8 8 0 0114-3m1 7a8 8 0 01-14 3" />
    </svg>
  ),
  'delete-pages': (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
    </svg>
  ),
  reorder: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16M8 6l-2-2m0 4l2-2m6 8l2 2m0-4l-2 2" />
    </svg>
  ),
  extract: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h9a2 2 0 002-2v-4m5-11l-8 8m0-6v6h6" />
    </svg>
  ),
  watermark: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M9 15l2-6 2 6m-3-2h2" />
    </svg>
  ),
  protect: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  unlock: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm2-10V7a4 4 0 118 0" />
    </svg>
  ),
  sign: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 20h16M4 16c3-1 5-4 8-4s5 3 8 4M6 12c2-1 3-3 6-3s4 2 6 3" />
    </svg>
  ),
  metadata: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
    </svg>
  ),
  word: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M8 8l1.5 8 2-6 2 6L15 8" />
    </svg>
  ),
  powerpoint: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M9 17V8h3a2.5 2.5 0 010 5H9" />
    </svg>
  ),
  excel: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M8 8l8 8M16 8l-8 8" />
    </svg>
  ),
  edit: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  html: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l-4 3 4 3m8-6l4 3-4 3m-2-8l-4 10" />
    </svg>
  ),
  organize: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  pdfa: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M12 3l8 4v6c0 5-3.5 8-8 8s-8-3-8-8V7l8-4z" />
    </svg>
  ),
  repair: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.7 6.3a4 4 0 00-5.4 5.4l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.4-5.4l-2.2 2.2-2-2 2.2-2.2z" />
    </svg>
  ),
  pageNumbers: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M9 18h1v-3l-1 1M14 15h2v3h-2v-1.5" />
    </svg>
  ),
  compare: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3v18M15 3v18M4 6h4M4 12h4M4 18h4M16 8h4M16 14h4" />
    </svg>
  ),
  redact: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z M7 10h10M7 14h6" />
      <rect x="6" y="9" width="8" height="2" fill="currentColor" />
    </svg>
  ),
  crop: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 2v16h16M2 6h16v16" />
    </svg>
  ),
  forms: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  ai: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.7 3.3l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3 1.3-3zM17 12l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8zM6 16l.6 1.4 1.4.6-1.4.6L6 20l-.6-1.4-1.4-.6 1.4-.6L6 16z" />
    </svg>
  ),
  translate: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2c0 5-3 8-6 8m4-4c0 3 3 6 8 6M14 21l5-12 5 12m-8.5-3h7" />
    </svg>
  ),
  markdown: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6h18v12H3z M6 15V9l2.5 3L11 9v6M14 9v6m0 0l2-2m-2 2l-2-2" />
    </svg>
  ),
  workflow: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7zM17 3h4M17 7h4" />
    </svg>
  ),
};

const TOOLS: Tool[] = [
  { label: 'Merge PDF',      href: '/pdf/merge',        description: 'Combine multiple PDFs into one — drag to reorder',                 category: 'organize',     icon: ICONS.merge },
  { label: 'Split PDF',      href: '/pdf/split',        description: 'Extract specific pages with visual thumbnail selection',           category: 'organize',     icon: ICONS.split },
  { label: 'Delete Pages',   href: '/pdf/delete-pages', description: 'Remove unwanted pages with a live preview grid',                   category: 'organize',     icon: ICONS['delete-pages'] },
  { label: 'Reorder Pages',  href: '/pdf/reorder',      description: 'Rearrange pages by clicking thumbnails in a new order',            category: 'organize',     icon: ICONS.reorder },
  { label: 'Extract Pages',  href: '/pdf/extract',      description: 'Pull selected pages out into a new PDF file',                      category: 'organize',     icon: ICONS.extract },

  { label: 'Compress PDF',   href: '/pdf/compress',     description: 'Shrink file size with low / medium / high presets',                category: 'optimize',     icon: ICONS.compress },

  { label: 'PDF to Images',  href: '/pdf/to-images',    description: 'Render pages to JPG or PNG at up to 600 DPI',                      category: 'convert',      icon: ICONS['to-images'] },
  { label: 'Images to PDF',  href: '/pdf/from-images',  description: 'Combine JPG, PNG or HEIC files into a PDF document',               category: 'convert',      icon: ICONS['from-images'] },

  { label: 'Rotate PDF',     href: '/pdf/rotate',       description: 'Rotate all or selected pages by 90°, 180°, or 270°',               category: 'edit',         icon: ICONS.rotate },
  { label: 'Watermark PDF',  href: '/pdf/watermark',    description: 'Overlay text or image with opacity, rotation, and position',       category: 'edit',         icon: ICONS.watermark },
  { label: 'Sign PDF',       href: '/pdf/sign',         description: 'Draw, type, or upload your signature onto any page',               category: 'edit',         icon: ICONS.sign },
  { label: 'PDF Metadata',   href: '/pdf/metadata',     description: 'Edit title, author, subject, keywords, and dates',                 category: 'edit',         icon: ICONS.metadata },

  { label: 'Protect PDF',    href: '/pdf/protect',      description: 'Add password with fine-grained permission controls',                category: 'security',     icon: ICONS.protect },
  { label: 'Unlock PDF',     href: '/pdf/unlock',       description: 'Remove password from PDFs you own with valid credentials',          category: 'security',     icon: ICONS.unlock },

  { label: 'OCR PDF',        href: '/pdf/ocr',          description: 'Extract text from scans in 6 languages — outputs searchable PDF',   category: 'intelligence', icon: ICONS.ocr },

  { label: 'Scan to PDF',    href: '/pdf/scan',         description: 'Photo → auto-crop, enhance, OCR, and bundle into one PDF',          category: 'workflows',    icon: ICONS.scan },

  // --- Coming soon ---
  { label: 'PDF to Word',       href: '#', description: 'Convert PDF files into easy-to-edit DOC and DOCX documents.',                        category: 'convert',      icon: ICONS.word,        comingSoon: true },
  { label: 'PDF to PowerPoint', href: '#', description: 'Turn PDF files into easy-to-edit PPT and PPTX slideshows.',                          category: 'convert',      icon: ICONS.powerpoint,  comingSoon: true },
  { label: 'PDF to Excel',      href: '#', description: 'Pull data straight from PDFs into Excel spreadsheets in seconds.',                    category: 'convert',      icon: ICONS.excel,       comingSoon: true },
  { label: 'Word to PDF',       href: '#', description: 'Make DOC and DOCX files easy to read by converting them to PDF.',                     category: 'convert',      icon: ICONS.word,        comingSoon: true },
  { label: 'PowerPoint to PDF', href: '#', description: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',                category: 'convert',      icon: ICONS.powerpoint,  comingSoon: true },
  { label: 'Excel to PDF',      href: '#', description: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',                     category: 'convert',      icon: ICONS.excel,       comingSoon: true },
  { label: 'HTML to PDF',       href: '#', description: 'Convert webpages in HTML to PDF — paste a URL and export in one click.',              category: 'convert',      icon: ICONS.html,        comingSoon: true },
  { label: 'PDF to Markdown',   href: '#', description: 'Turn PDFs into Markdown. Perfect for notes, docs, and LLMs — headings preserved.',    category: 'convert',      icon: ICONS.markdown,    comingSoon: true, isNew: true },

  { label: 'Edit PDF',          href: '#', description: 'Add text, images, shapes, or freehand annotations. Change font, size, and color.',    category: 'edit',         icon: ICONS.edit,        comingSoon: true },
  { label: 'Page Numbers',      href: '#', description: 'Add page numbers to PDFs — pick position, dimensions, and typography.',               category: 'edit',         icon: ICONS.pageNumbers, comingSoon: true },
  { label: 'Crop PDF',          href: '#', description: 'Crop margins or select specific areas, then apply to one page or the whole doc.',      category: 'edit',         icon: ICONS.crop,        comingSoon: true },
  { label: 'Organize PDF',      href: '#', description: 'Sort, delete, and insert pages in one unified page manager view.',                     category: 'organize',     icon: ICONS.organize,    comingSoon: true },

  { label: 'PDF to PDF/A',      href: '#', description: 'Convert to PDF/A, the ISO-standard for long-term archival preservation.',              category: 'optimize',     icon: ICONS.pdfa,        comingSoon: true },
  { label: 'Repair PDF',        href: '#', description: 'Recover data from damaged or corrupt PDF files.',                                       category: 'optimize',     icon: ICONS.repair,      comingSoon: true },

  { label: 'Redact PDF',        href: '#', description: 'Permanently remove sensitive text and graphics from a PDF.',                            category: 'security',     icon: ICONS.redact,      comingSoon: true },
  { label: 'PDF Forms',         href: '#', description: 'Detect fields, create fillable PDFs, or fill forms — text, checkboxes, lists.',        category: 'edit',         icon: ICONS.forms,       comingSoon: true, isNew: true },

  { label: 'Compare PDF',       href: '#', description: 'Side-by-side comparison — spot changes between document versions.',                    category: 'intelligence', icon: ICONS.compare,     comingSoon: true },
  { label: 'AI Summarizer',     href: '#', description: 'Generate concise summaries from articles and long PDFs in seconds.',                   category: 'intelligence', icon: ICONS.ai,          comingSoon: true, isNew: true },
  { label: 'Translate PDF',     href: '#', description: 'Translate PDFs with AI — fonts, layout, and formatting stay intact.',                  category: 'intelligence', icon: ICONS.translate,   comingSoon: true, isNew: true },

  { label: 'Create Workflow',   href: '#', description: 'Chain your favorite tools into custom workflows, automate, and reuse anytime.',        category: 'workflows',    icon: ICONS.workflow,    comingSoon: true },
];

function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
        {count}
      </span>
    </button>
  );
}

export default function PdfDashboard() {
  const [activeCat, setActiveCat] = useState<'all' | CategoryKey>('all');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: TOOLS.length };
    for (const cat of CATEGORIES) c[cat.key] = TOOLS.filter((t) => t.category === cat.key).length;
    return c;
  }, []);

  const filtered = useMemo(() => {
    let list = TOOLS;
    if (activeCat !== 'all') list = list.filter((t) => t.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return list;
  }, [activeCat, search]);

  const catMeta = (k: CategoryKey) => CATEGORIES.find((c) => c.key === k)!;

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(217,70,239,0.12),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Tools
          </Link>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight max-w-4xl mx-auto">
            Every tool you need to work with PDFs <span className="text-blue-400">in one place</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Every tool you need to use PDFs, at your fingertips. All are <span className="text-white font-semibold">100% FREE</span> and easy to use.
            Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[`${TOOLS.length} tools`, '100% in browser', 'No uploads', 'Free forever'].map((chip) => (
              <span key={chip} className="inline-flex items-center gap-1.5 bg-white/10 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                {chip}
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-lg mx-auto mt-10">
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
              placeholder="Search PDF tools..."
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/15 transition-all"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-3">
            <TabButton active={activeCat === 'all'} onClick={() => setActiveCat('all')} count={counts.all}>All</TabButton>
            {CATEGORIES.map((c) => (
              <TabButton key={c.key} active={activeCat === c.key} onClick={() => setActiveCat(c.key)} count={counts[c.key]}>
                {c.label}
              </TabButton>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No tools match</h3>
            <p className="text-sm text-slate-500">Try a different search term or category</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-6 font-medium tracking-wide uppercase">
              {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
              {activeCat !== 'all' && ` · ${catMeta(activeCat).label}`}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((tool, i) => {
                const meta = catMeta(tool.category);
                const cardInner = (
                  <>
                    {tool.isNew && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white shadow-sm">
                        New
                      </span>
                    )}
                    <div className={`inline-flex w-12 h-12 rounded-xl items-center justify-center ${meta.bg} ${meta.text} ring-1 ${meta.ring} mb-4 ${!tool.comingSoon ? 'group-hover:scale-110' : ''} transition-transform`}>
                      {tool.icon}
                    </div>
                    <h3 className={`text-base font-bold mb-1.5 ${tool.comingSoon ? 'text-slate-700' : 'text-slate-900 group-hover:text-slate-950'}`}>
                      {tool.label}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                      {tool.comingSoon ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-500">
                          Coming Soon
                        </span>
                      ) : (
                        <span className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </>
                );

                if (tool.comingSoon) {
                  return (
                    <div
                      key={`${tool.label}-${i}`}
                      className="group relative bg-white rounded-2xl border border-dashed border-slate-200 p-6 opacity-75 cursor-not-allowed"
                      aria-disabled="true"
                    >
                      {cardInner}
                    </div>
                  );
                }

                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200 hover:-translate-y-1"
                  >
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
