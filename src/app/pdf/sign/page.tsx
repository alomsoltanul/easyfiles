import PdfSign from '@/components/PdfSign';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export const dynamic = 'force-dynamic';

export default function PdfSignPage() {
  return (
    <ToolLayout
      title="Sign PDF"
      description="Add your signature to PDF documents"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Your signatures are processed securely.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Multiple Methods', description: 'Draw, type, or upload your signature image.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Flexible Placement', description: 'Place your signature anywhere on the document.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/sign">
        <PdfSign />
      </ToolGate>
    </ToolLayout>
  );
}
