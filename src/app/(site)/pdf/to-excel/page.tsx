import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PdfToExcelPage() {
  return (
    <ToolLayout
      title="PDF to Excel"
      description="Extract PDF tables and text into XLSX spreadsheets"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'Private',            description: 'Text is parsed locally — nothing uploaded.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'One Sheet per Page', description: 'Every PDF page becomes its own worksheet with rows and columns.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'XLSX Output',        description: 'Open the result in Excel, Numbers, or Google Sheets.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/to-excel">
        <DocConverter
          toolType="pdf-to-excel"
          accept=".pdf,application/pdf"
          acceptLabel="PDF files supported"
          uploadTitle="Drop your PDF here"
          uploadSubtitle="or click to browse — .pdf"
          actionLabel="Convert to Excel"
          successTitle="PDF converted to Excel!"
          filterExt=".pdf"
          showPdfPreview
        />
      </ToolGate>
    </ToolLayout>
  );
}
