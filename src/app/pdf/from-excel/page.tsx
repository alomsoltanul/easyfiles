import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function ExcelToPdfPage() {
  return (
    <ToolLayout
      title="Excel to PDF"
      description="Turn XLSX and XLS spreadsheets into shareable PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'In-Browser Only', description: 'Sheets are parsed locally — no server involved.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'Multiple Sheets', description: 'Each worksheet becomes its own labeled section in the PDF.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'Landscape Layout', description: 'Wide tables fit better with automatic landscape output.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/from-excel">
        <DocConverter
          toolType="excel-to-pdf"
          accept=".xls,.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          acceptLabel="XLSX / XLS / CSV supported"
          uploadTitle="Drop your spreadsheet here"
          uploadSubtitle="or click to browse — .xlsx / .xls / .csv"
          actionLabel="Convert to PDF"
          successTitle="Spreadsheet converted to PDF!"
          filterExt=".xls,.xlsx,.csv"
        />
      </ToolGate>
    </ToolLayout>
  );
}
