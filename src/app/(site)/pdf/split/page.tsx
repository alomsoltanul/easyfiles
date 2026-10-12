import PdfSplitter from '@/components/PdfSplitter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfSplitPage() {
  return (
    <ToolLayout
      title="Split PDF"
      description="Extract specific pages or split a PDF into individual page files"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All splitting happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Page Preview', description: 'Visual thumbnails let you select exactly which pages to extract.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Flexible Options', description: 'Extract selected pages or split the entire PDF into individual files.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/split">
        <PdfSplitter />
      </ToolGate>
    </ToolLayout>
  );
}
