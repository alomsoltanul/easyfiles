import PdfPageNumbers from '@/components/PdfPageNumbers';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Add Page Numbers to PDF — Free, In Your Browser',
  description: 'Add page numbers to a PDF with custom position, format, fonts, colours, page ranges and mirrored margins. Runs entirely in your browser.',
};

export const dynamic = 'force-dynamic';

export default function PdfPageNumbersPage() {
  return (
    <ToolLayout
      title="Add Page Numbers to PDF"
      description="Number your pages with full control over position, format, and typography"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Numbering happens in your browser. Your PDF is never uploaded.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Live Preview', description: 'See exactly where each number lands before you export.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Full Control', description: 'Roman numerals, custom templates, page ranges and mirrored margins.' },
        ]} />
      }
    >
      <PdfPageNumbers />
    </ToolLayout>
  );
}
