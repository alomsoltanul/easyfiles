import PdfRepair from '@/components/PdfRepair';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Repair PDF — Recover Damaged and Corrupt Files',
  description: 'Diagnose a broken PDF, rebuild its cross-reference table, strip junk bytes, and salvage readable pages when the structure is beyond repair.',
};

export const dynamic = 'force-dynamic';

export default function PdfRepairPage() {
  return (
    <ToolLayout
      title="Repair PDF"
      description="Diagnose and recover damaged, truncated or unreadable PDF files"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Recovery runs in your browser — nothing is uploaded.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Full Diagnostics', description: 'See exactly what is broken before anything is changed.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Layered Recovery', description: 'Structural rebuild first, page salvage only as a last resort.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/repair">
        <PdfRepair />
      </ToolGate>
    </ToolLayout>
  );
}
