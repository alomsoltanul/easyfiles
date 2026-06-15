'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: { label: string; href: string; description: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'image',
    label: 'Image Tools',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    items: [
      { label: 'Convert', href: '/image/convert', description: 'HEIC, JPEG, PNG, WebP — any format to any format' },
      { label: 'Compress', href: '/image/compress', description: 'Reduce image file size while keeping quality' },
      { label: 'Resize', href: '/image/resize', description: 'Change dimensions with preset sizes' },
    ],
  },
  {
    id: 'pdf',
    label: 'PDF Tools',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    items: [
      { label: 'Merge PDFs', href: '/pdf/merge', description: 'Combine multiple PDFs into one document' },
      { label: 'Split PDF', href: '/pdf/split', description: 'Extract pages from a PDF' },
      { label: 'Compress PDF', href: '/pdf/compress', description: 'Reduce PDF file size' },
      { label: 'PDF to Images', href: '/pdf/to-images', description: 'Convert PDF pages to JPG or PNG' },
      { label: 'Images to PDF', href: '/pdf/from-images', description: 'Combine images into a PDF' },
      { label: 'Scan to PDF', href: '/pdf/scan', description: 'Scan document photos with enhancement' },
      { label: 'OCR PDF', href: '/pdf/ocr', description: 'Extract text, create searchable PDFs' },
      { label: 'Rotate PDF', href: '/pdf/rotate', description: 'Rotate pages by 90°, 180°, or 270°' },
      { label: 'Delete Pages', href: '/pdf/delete-pages', description: 'Remove unwanted pages' },
      { label: 'Reorder Pages', href: '/pdf/reorder', description: 'Rearrange page order visually' },
      { label: 'Extract Pages', href: '/pdf/extract', description: 'Pull pages into a new PDF' },
      { label: 'Watermark PDF', href: '/pdf/watermark', description: 'Add text or image watermarks' },
      { label: 'Protect PDF', href: '/pdf/protect', description: 'Password-protect with encryption' },
      { label: 'Unlock PDF', href: '/pdf/unlock', description: 'Remove password protection' },
      { label: 'Sign PDF', href: '/pdf/sign', description: 'Draw, type, or upload a signature' },
      { label: 'PDF Metadata', href: '/pdf/metadata', description: 'Edit title, author, keywords' },
    ],
  },
  {
    id: 'json',
    label: 'JSON Tools',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
      </svg>
    ),
    items: [
      { label: 'Formatter', href: '/json/format', description: 'Pretty print JSON with collapsible tree view' },
      { label: 'Validator', href: '/json/validate', description: 'Validate syntax with line-level error reporting' },
      { label: 'Minifier', href: '/json/minify', description: 'Compress JSON with size comparison' },
      { label: 'JSON ↔ CSV', href: '/json/csv', description: 'Convert between JSON arrays and CSV tables' },
      { label: 'JSON ↔ YAML', href: '/json/yaml', description: 'Convert between JSON and YAML formats' },
      { label: 'Diff / Compare', href: '/json/diff', description: 'Side-by-side JSON comparison' },
      { label: 'TS Interface', href: '/json/ts-interface', description: 'Generate TypeScript interfaces from JSON' },
      { label: 'Escape / Unescape', href: '/json/escape', description: 'Escape strings for JSON or unescape them' },
      { label: 'JSONPath Eval', href: '/json/jsonpath', description: 'Query JSON with JSONPath expressions' },
      { label: 'Sort Keys', href: '/json/sort', description: 'Sort object keys alphabetically' },
      { label: 'URL Params', href: '/json/url-params', description: 'Convert between JSON and URL query strings' },
    ],
  },
  {
    id: 'video',
    label: 'Video Tools',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    items: [
      { label: 'Video Downloader', href: '/video', description: 'Download from YouTube, Facebook, Instagram, X' },
    ],
  },
];

function NavDropdown({ section, pathname }: { section: NavSection; pathname: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = pathname ? section.items.some((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) : false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
          ${isActive
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }
        `}
      >
        {section.icon}
        <span className="hidden sm:inline">{section.label}</span>
        <svg className={`w-3 h-3 hidden sm:block transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 overflow-hidden ${
          section.items.length > 6 ? 'right-0 w-136 max-w-[calc(100vw-2rem)]' : 'left-0 w-72'
        }`}>
          <div className={`p-2 max-h-[70vh] overflow-y-auto ${section.items.length > 6 ? 'grid grid-cols-1 sm:grid-cols-2 gap-1' : ''}`}>
            {section.items.map((item) => {
              const itemActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    block px-4 py-3 rounded-xl transition-colors duration-150
                    ${itemActive
                      ? 'bg-emerald-50 border border-emerald-100'
                      : 'hover:bg-slate-50'
                    }
                  `}
                >
                  <p className={`text-sm font-semibold ${itemActive ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-200 group-hover:shadow-md group-hover:shadow-emerald-200 transition-shadow duration-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">ConvertTools</h1>
              <p className="text-xs text-slate-500 font-medium">All-in-one daily tools</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-100 mr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              100% Free & Private
            </div>
            <div className="bg-slate-100 rounded-xl p-1 flex gap-1">
              {NAV_SECTIONS.map((section) => (
                <NavDropdown key={section.id} section={section} pathname={pathname} />
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
