import PdfCompare from '@/components/PdfCompare';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Compare PDF — Find Changes Between Two Versions',
  description: 'Compare two PDFs page by page with a pixel difference overlay and a word-level text diff, then export a shareable comparison report.',
};

export const dynamic = 'force-dynamic';

export default function PdfComparePage() {
  return (
    <ToolLayout
      title="Compare PDF"
      description="Spot every change between two versions — side by side, overlaid, or as a word diff"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Both documents are compared locally in your browser.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Pixel & Text', description: 'A visual difference overlay plus a real word-level diff.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Shareable Report', description: 'Export a PDF report with the summary and every changed page.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/compare">
        <PdfCompare />
      </ToolGate>
    </ToolLayout>
  );
}
