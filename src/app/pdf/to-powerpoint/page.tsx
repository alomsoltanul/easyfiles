import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PdfToPowerPointPage() {
  return (
    <ToolLayout
      title="PDF to PowerPoint"
      description="Turn every PDF page into an editable slide"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'Private',           description: 'Pages are rendered locally in your browser.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'One Page = 1 Slide', description: 'Each PDF page becomes a full-size slide image in the PPTX.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'Widescreen',        description: 'Uses the 16:9 layout for modern presentations.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/to-powerpoint">
        <DocConverter
          toolType="pdf-to-powerpoint"
          accept=".pdf,application/pdf"
          acceptLabel="PDF files supported"
          uploadTitle="Drop your PDF here"
          uploadSubtitle="or click to browse — .pdf"
          actionLabel="Convert to PowerPoint"
          successTitle="PDF converted to PowerPoint!"
          filterExt=".pdf"
          showPdfPreview
        />
      </ToolGate>
    </ToolLayout>
  );
}
