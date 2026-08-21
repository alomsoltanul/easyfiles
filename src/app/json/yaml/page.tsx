import JsonYaml from '@/components/JsonYaml';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonYamlPage() {
  return (
    <ToolLayout
      title="JSON ↔ YAML Converter"
      description="Convert between JSON and YAML formats — great for config files"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All conversion happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Two-Way Conversion', description: 'Convert JSON to YAML and YAML to JSON seamlessly.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Config File Ready', description: 'Perfect for converting between config formats used by Docker, K8s, etc.' },
        ]} />
      }
    >
      <ToolGate slug="/json/yaml">
        <JsonYaml />
      </ToolGate>
    </ToolLayout>
  );
}
