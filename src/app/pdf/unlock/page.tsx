import PdfUnlock from '@/components/PdfUnlock';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfUnlockPage() {
  return (
    <ToolLayout
      title="Unlock PDF"
      description="Remove password protection from your PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are processed securely and never stored.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Password Required', description: 'You must provide the valid password to unlock.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Instant Results', description: 'Get your unlocked PDF in seconds.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/unlock">
        <PdfUnlock />
      </ToolGate>
    </ToolLayout>
  );
}
