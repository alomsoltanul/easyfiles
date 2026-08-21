import PdfOrganize from '@/components/PdfOrganize';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Organize PDF — Sort, Delete and Insert Pages',
  description: 'Reorder, rotate, duplicate and delete PDF pages, merge in other PDFs and insert blank sheets — all in one page manager.',
};

export const dynamic = 'force-dynamic';

export default function PdfOrganizePage() {
  return (
    <ToolLayout
      title="Organize PDF"
      description="Sort, rotate, delete, duplicate and insert pages in one unified page manager"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Every page stays on your device from upload to download.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'One Workspace', description: 'Reorder, rotate, delete and duplicate without switching tools.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Merge & Insert', description: 'Pull pages in from other PDFs or add blank sheets anywhere.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/organize">
        <PdfOrganize />
      </ToolGate>
    </ToolLayout>
  );
}
