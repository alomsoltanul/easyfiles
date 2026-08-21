import PdfProtect from '@/components/PdfProtect';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfProtectPage() {
  return (
    <ToolLayout
      title="Protect PDF"
      description="Password-protect your PDF with AES-256 encryption"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your PDFs are encrypted with AES-256 security.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Permission Control', description: 'Restrict printing, editing, and copying.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Strong Encryption', description: 'Industry-standard encryption for your documents.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/protect">
        <PdfProtect />
      </ToolGate>
    </ToolLayout>
  );
}
