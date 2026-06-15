import Link from 'next/link';

const footerLinks = [
  {
    title: 'Image Tools',
    moreHref: '/image',
    items: [
      { label: 'Image Converter', href: '/image/convert' },
      { label: 'Image Compressor', href: '/image/compress' },
      { label: 'Image Resizer', href: '/image/resize' },
    ],
  },
  {
    title: 'PDF Tools',
    moreHref: '/pdf',
    items: [
      { label: 'Merge PDFs', href: '/pdf/merge' },
      { label: 'Split PDF', href: '/pdf/split' },
      { label: 'Compress PDF', href: '/pdf/compress' },
      { label: 'PDF to Images', href: '/pdf/to-images' },
      { label: 'Sign PDF', href: '/pdf/sign' },
      { label: 'Protect PDF', href: '/pdf/protect' },
      { label: 'OCR PDF', href: '/pdf/ocr' },
      { label: 'Watermark PDF', href: '/pdf/watermark' },
    ],
  },
  {
    title: 'JSON Tools',
    moreHref: '/json',
    items: [
      { label: 'JSON Formatter', href: '/json/format' },
      { label: 'JSON Validator', href: '/json/validate' },
      { label: 'JSON Minifier', href: '/json/minify' },
      { label: 'JSON Diff', href: '/json/diff' },
      { label: 'JSON ↔ YAML', href: '/json/yaml' },
      { label: 'JSON ↔ CSV', href: '/json/csv' },
    ],
  },
  {
    title: 'Video Tools',
    moreHref: '/video',
    items: [
      { label: 'Video Downloader', href: '/video' },
    ],
  },
];

export default function GlobalFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-12">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={section.moreHref}
                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    View all →
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">ConvertTools</span>
          </div>

          <p className="text-xs text-slate-400 text-center">
            All processing happens in your browser. No uploads, no tracking, no limits.
          </p>

          <span className="text-xs text-slate-300">Free & Open Source</span>
        </div>
      </div>
    </footer>
  );
}
