import PdfCrop from '@/components/PdfCrop';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Crop PDF — Trim Margins or Select an Area',
  description: 'Crop PDF pages by trimming margins or dragging a selection. Auto-detects content bounds. Free and fully client-side.',
};

export const dynamic = 'force-dynamic';

export default function PdfCropPage() {
  return (
    <ToolLayout
      title="Crop PDF"
      description="Trim margins or select an exact area, then apply it to one page or the whole document"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Cropping runs locally — nothing is uploaded anywhere.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Auto-Detect', description: 'One click finds the content bounds and crops away dead space.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Page Ranges', description: 'Apply the same crop to every page or only the ones you choose.' },
        ]} />
      }
    >
      <PdfCrop />
    </ToolLayout>
  );
}
