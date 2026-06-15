import PdfDeletePages from '@/components/PdfDeletePages';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfDeletePagesPage() {
  return (
    <ToolLayout
      title="Delete Pages"
      description="Remove unwanted pages from your PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All processing happens on our secure servers.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Visual Selection', description: 'Preview pages and select exactly which ones to delete.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Instant Results', description: 'Get your updated PDF in seconds.' },
        ]} />
      }
    >
      <PdfDeletePages />
    </ToolLayout>
  );
}
