import JsonValidator from '@/components/JsonValidator';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonValidatePage() {
  return (
    <ToolLayout
      title="JSON Validator"
      description="Validate JSON syntax and get detailed error messages with line numbers"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All validation happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Detailed Errors', description: 'Get precise line numbers and error descriptions for quick fixes.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Real-time Check', description: 'JSON is validated instantly as you type or paste your content.' },
        ]} />
      }
    >
      <JsonValidator />
    </ToolLayout>
  );
}
