import JsonMinifier from '@/components/JsonMinifier';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonMinifyPage() {
  return (
    <ToolLayout
      title="JSON Minifier"
      description="Compress JSON by removing whitespace — see before/after size comparison"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All minification happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Size Comparison', description: 'See exactly how much space you save with before/after file sizes.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Copy & Download', description: 'Quick copy to clipboard or download the minified JSON file.' },
        ]} />
      }
    >
      <ToolGate slug="/json/minify">
        <JsonMinifier />
      </ToolGate>
    </ToolLayout>
  );
}
