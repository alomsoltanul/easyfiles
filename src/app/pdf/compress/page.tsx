import PdfCompressor from '@/components/PdfCompressor';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PdfCompressPage() {
  return (
    <ToolLayout
      title="Compress PDF"
      description="Reduce PDF file size without losing document quality"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All compression happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Smart Compression', description: 'Optimizes PDF structure and removes unnecessary data automatically.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Before & After', description: 'See exactly how much space you saved with clear size comparison.' },
        ]} />
      }
    >
      <PdfCompressor />
    </ToolLayout>
  );
}
