import JsonDiff from '@/components/JsonDiff';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonDiffPage() {
  return (
    <ToolLayout
      title="JSON Diff / Compare"
      description="Compare two JSON objects side by side and see highlighted differences"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All comparison happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Side-by-Side', description: 'Paste two JSON objects and see differences highlighted inline.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Color Coded', description: 'Additions in green, removals in red, unchanged lines in default.' },
        ]} />
      }
    >
      <ToolGate slug="/json/diff">
        <JsonDiff />
      </ToolGate>
    </ToolLayout>
  );
}
