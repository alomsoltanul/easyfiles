import PdfToImages from '@/components/PdfToImages';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfToImagesPage() {
  return (
    <ToolLayout
      title="PDF to Images"
      description="Convert each page of your PDF to high-quality JPG or PNG images"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All conversion happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'High Quality Output', description: 'Choose JPEG or PNG format with high-resolution rendering.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Page by Page', description: 'Each PDF page becomes a separate image file ready to use.' },
        ]} />
      }
    >
      <PdfToImages />
    </ToolLayout>
  );
}
