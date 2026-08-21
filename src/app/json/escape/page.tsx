import JsonEscape from '@/components/JsonEscape';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonEscapePage() {
  return (
    <ToolLayout
      title="JSON Escape / Unescape"
      description="Escape special characters for JSON strings or unescape them back to raw text"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All processing happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Two Modes', description: 'Escape strings for JSON or unescape JSON strings back to plain text.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Handles All Chars', description: 'Properly escapes quotes, newlines, tabs, unicode, and backslashes.' },
        ]} />
      }
    >
      <ToolGate slug="/json/escape">
        <JsonEscape />
      </ToolGate>
    </ToolLayout>
  );
}
