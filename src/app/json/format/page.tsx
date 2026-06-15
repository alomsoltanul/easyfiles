import JsonFormatter from '@/components/JsonFormatter';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonFormatPage() {
  return (
    <ToolLayout
      title="JSON Formatter & Viewer"
      description="Pretty print JSON with syntax highlighting, collapsible tree view, and download"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All processing happens in your browser. Your data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Instant Formatting', description: 'Real-time formatting as you type with adjustable indentation.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Tree View', description: 'Collapsible tree view for exploring deeply nested JSON structures.' },
        ]} />
      }
    >
      <JsonFormatter />
    </ToolLayout>
  );
}
