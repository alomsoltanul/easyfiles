import PdfWatermark from '@/components/PdfWatermark';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfWatermarkPage() {
  return (
    <ToolLayout
      title="Watermark PDF"
      description="Add text or image watermarks to your PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are processed securely and never shared.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Customizable', description: 'Control opacity, rotation, position, and size.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Text & Images', description: 'Use text or upload an image as your watermark.' },
        ]} />
      }
    >
      <PdfWatermark />
    </ToolLayout>
  );
}
