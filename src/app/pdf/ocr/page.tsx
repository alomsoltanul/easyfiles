import PdfOCR from '@/components/PdfOCR';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfOCRPage() {
  return (
    <ToolLayout
      title="OCR PDF"
      description="Extract text from PDFs and images with support for multiple languages"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your documents are processed securely and deleted after 24 hours.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Multi-Language', description: 'Support for English, Japanese, Bengali, Arabic, Chinese, and Korean.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Searchable PDFs', description: 'Convert scanned documents into searchable PDFs with invisible text layers.' },
        ]} />
      }
    >
      <PdfOCR />
    </ToolLayout>
  );
}
