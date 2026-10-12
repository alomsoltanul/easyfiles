import ImagesToPdf from '@/components/ImagesToPdf';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export default function ImagesToPdfPage() {
  return (
    <ToolLayout
      title="Images to PDF"
      description="Combine multiple images into a single PDF document"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All conversion happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Arrange & Order', description: 'Drag and drop to reorder images before generating the final PDF.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Page Size Options', description: 'Choose A4 or Letter page sizes for your generated PDF document.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/from-images">
        <ImagesToPdf />
      </ToolGate>
    </ToolLayout>
  );
}
