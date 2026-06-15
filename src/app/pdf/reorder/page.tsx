import PdfReorder from '@/components/PdfReorder';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfReorderPage() {
  return (
    <ToolLayout
      title="Reorder Pages"
      description="Rearrange pages in your PDF by dragging and dropping"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are processed securely and never shared.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Drag & Drop', description: 'Intuitive visual reordering with page thumbnails.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Instant Results', description: 'Get your reordered PDF in seconds.' },
        ]} />
      }
    >
      <PdfReorder />
    </ToolLayout>
  );
}
