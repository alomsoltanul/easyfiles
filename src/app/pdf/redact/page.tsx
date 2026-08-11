import PdfRedact from '@/components/PdfRedact';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Redact PDF — Permanently Remove Sensitive Content',
  description: 'Truly redact a PDF: marked areas are burned out of the page rather than covered, so nothing is recoverable. Includes find-and-redact by text.',
};

export const dynamic = 'force-dynamic';

export default function PdfRedactPage() {
  return (
    <ToolLayout
      title="Redact PDF"
      description="Permanently remove sensitive text and graphics — not just cover them up"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Redaction runs in your browser — the original never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Actually Removed', description: 'Marked regions are destroyed in the output, not hidden behind a box.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Find & Redact', description: 'Search for a name or number and mark every occurrence at once.' },
        ]} />
      }
    >
      <PdfRedact />
    </ToolLayout>
  );
}
