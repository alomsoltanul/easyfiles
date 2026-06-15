import JsonUrlParams from '@/components/JsonUrlParams';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonUrlParamsPage() {
  return (
    <ToolLayout
      title="JSON ↔ URL Params"
      description="Convert between JSON objects and URL query parameter strings"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All conversion happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Two-Way Converter', description: 'Convert URL query strings to JSON objects and vice versa.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Proper Encoding', description: 'Handles URL encoding/decoding of special characters automatically.' },
        ]} />
      }
    >
      <JsonUrlParams />
    </ToolLayout>
  );
}
