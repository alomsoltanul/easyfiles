import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PdfToWordPage() {
  return (
    <ToolLayout
      title="PDF to Word"
      description="Extract PDF text into editable DOCX documents"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'Private',           description: 'Text extraction runs entirely in your browser.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'Editable Output',   description: 'Open the DOCX in Word, Pages, or Google Docs and edit freely.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'Page Breaks',       description: 'Each PDF page becomes a new page in the Word document.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/to-word">
        <DocConverter
          toolType="pdf-to-word"
          accept=".pdf,application/pdf"
          acceptLabel="PDF files supported"
          uploadTitle="Drop your PDF here"
          uploadSubtitle="or click to browse — .pdf"
          actionLabel="Convert to Word"
          successTitle="PDF converted to Word!"
          filterExt=".pdf"
          showPdfPreview
        />
      </ToolGate>
    </ToolLayout>
  );
}
