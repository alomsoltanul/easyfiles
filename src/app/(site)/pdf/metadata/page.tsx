import PdfMetadata from '@/components/PdfMetadata';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfMetadataPage() {
  return (
    <ToolLayout
      title="PDF Metadata Editor"
      description="Edit title, author, subject, keywords, and creation date"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are processed securely and never stored.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Easy Editing', description: 'Edit all metadata fields in one place.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Instant Results', description: 'Get your updated PDF in seconds.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/metadata">
        <PdfMetadata />
      </ToolGate>
    </ToolLayout>
  );
}
