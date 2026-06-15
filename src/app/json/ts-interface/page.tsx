import JsonTsInterface from '@/components/JsonTsInterface';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonTsInterfacePage() {
  return (
    <ToolLayout
      title="JSON to TypeScript Interface"
      description="Generate TypeScript interfaces or types from JSON data automatically"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All generation happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'interface or type', description: 'Choose between TypeScript interface or type alias syntax.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Nested Support', description: 'Handles nested objects, arrays, and mixed union types automatically.' },
        ]} />
      }
    >
      <JsonTsInterface />
    </ToolLayout>
  );
}
