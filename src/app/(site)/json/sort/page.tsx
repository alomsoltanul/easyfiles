import JsonSort from '@/components/JsonSort';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonSortPage() {
  return (
    <ToolLayout
      title="JSON Sort Keys"
      description="Sort JSON object keys alphabetically — recursively for nested objects"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All sorting happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Deep Sort', description: 'Recursively sorts keys in all nested objects, not just the top level.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Consistent Output', description: 'Ensure consistent key ordering across your JSON for diff tools and version control.' },
        ]} />
      }
    >
      <ToolGate slug="/json/sort">
        <JsonSort />
      </ToolGate>
    </ToolLayout>
  );
}
