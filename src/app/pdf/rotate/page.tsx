import PdfRotate from '@/components/PdfRotate';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfRotatePage() {
  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate individual pages or all pages in your PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are processed securely and never shared.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Flexible Rotation', description: 'Rotate by 90°, 180°, or 270° — for all pages or selected pages.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Preview Pages', description: 'Visual thumbnails help you select exactly which pages to rotate.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/rotate">
        <PdfRotate />
      </ToolGate>
    </ToolLayout>
  );
}
