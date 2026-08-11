import PdfToPdfA from '@/components/PdfToPdfA';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'PDF to PDF/A — ISO Archival Conversion',
  description: 'Convert PDF to PDF/A-1b, 2b or 3b with an embedded sRGB output intent, XMP conformance metadata and a font embedding audit.',
};

export const dynamic = 'force-dynamic';

export default function PdfToPdfAPage() {
  return (
    <ToolLayout
      title="PDF to PDF/A"
      description="Convert to the ISO archival standard with a real embedded colour profile"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Conversion happens locally — your archive copy never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Real Output Intent', description: 'An sRGB ICC profile is generated and embedded, as the standard requires.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Font Audit', description: 'See which fonts are embedded before you trust the file to an archive.' },
        ]} />
      }
    >
      <PdfToPdfA />
    </ToolLayout>
  );
}
