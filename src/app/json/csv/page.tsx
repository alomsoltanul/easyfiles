import JsonCsv from '@/components/JsonCsv';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export default function JsonCsvPage() {
  return (
    <ToolLayout
      title="JSON ↔ CSV Converter"
      description="Convert JSON arrays to CSV tables and parse CSV data back to JSON"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All conversion happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Two-Way Converter', description: 'Convert JSON to CSV and CSV back to JSON with one tool.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Bulk Data Ready', description: 'Handle large arrays of objects with proper escaping and formatting.' },
        ]} />
      }
    >
      <JsonCsv />
    </ToolLayout>
  );
}
