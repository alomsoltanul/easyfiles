import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function WordToPdfPage() {
  return (
    <ToolLayout
      title="Word to PDF"
      description="Convert DOC and DOCX files to clean, portable PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'Private & Local',    description: 'Your document is parsed in the browser — nothing uploaded.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'Fast Conversion',     description: 'Text extraction and PDF generation run instantly.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'Universal Format',    description: 'PDFs render identically on every device and reader.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/from-word">
        <DocConverter
          toolType="word-to-pdf"
          accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          acceptLabel="DOCX files supported"
          uploadTitle="Drop your Word document here"
          uploadSubtitle="or click to browse — .doc / .docx"
          actionLabel="Convert to PDF"
          successTitle="Word converted to PDF!"
          filterExt=".doc,.docx"
        />
      </ToolGate>
    </ToolLayout>
  );
}
