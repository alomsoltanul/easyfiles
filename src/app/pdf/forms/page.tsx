import PdfForms from '@/components/PdfForms';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'PDF Forms — Fill and Create Fillable PDFs',
  description: 'Detect AcroForm fields, fill text boxes, checkboxes, dropdowns and radio groups, flatten the result, or draw brand new fillable fields.',
};

export const dynamic = 'force-dynamic';

export default function PdfFormsPage() {
  return (
    <ToolLayout
      title="PDF Forms"
      description="Detect and fill existing form fields, or draw new fillable fields onto any PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Form data stays in your browser and is never transmitted.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Fill or Author', description: 'Complete an existing form, or turn a flat PDF into a fillable one.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Export Data', description: 'Pull the field values out as JSON or CSV in one click.' },
        ]} />
      }
    >
      <PdfForms />
    </ToolLayout>
  );
}
