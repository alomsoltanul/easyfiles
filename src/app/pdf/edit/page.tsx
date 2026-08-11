import PdfEditor from '@/components/PdfEditor';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'Edit PDF — Add Text, Images and Shapes',
  description: 'Add text, images, rectangles, ellipses, arrows, highlights and freehand drawing to a PDF. Undo, redo and per-object editing included.',
};

export const dynamic = 'force-dynamic';

export default function PdfEditPage() {
  return (
    <ToolLayout
      title="Edit PDF"
      description="Add text, images, shapes and freehand annotations to any page"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'The editor runs in your browser — your document never leaves it.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Real Objects', description: 'Text stays vector text and shapes stay crisp at any zoom.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Undo & Redo', description: 'Every change is tracked, so experimenting costs nothing.' },
        ]} />
      }
    >
      <PdfEditor />
    </ToolLayout>
  );
}
