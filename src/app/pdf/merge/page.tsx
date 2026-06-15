import PdfMerger from '@/components/PdfMerger';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export default function PdfMergePage() {
  return (
    <ToolLayout
      title="Merge PDFs"
      description="Combine multiple PDF files into a single document — free and private"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All merging happens in your browser. Your documents never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Instant Processing', description: 'Client-side PDF merging with zero server uploads for maximum speed.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Reorder Pages', description: 'Drag and drop to rearrange files before merging in any order you want.' },
        ]} />
      }
    >
      <PdfMerger />
    </ToolLayout>
  );
}
