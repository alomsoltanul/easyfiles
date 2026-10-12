import PdfExtract from '@/components/PdfExtract';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfExtractPage() {
  return (
    <ToolLayout
      title="Extract Pages"
      description="Extract specific pages from your PDF into a new document"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All processing happens on our secure servers.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Flexible Selection', description: 'Extract single pages or ranges like 1, 3, 5-10.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Instant Results', description: 'Get your extracted PDF in seconds.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/extract">
        <PdfExtract />
      </ToolGate>
    </ToolLayout>
  );
}
