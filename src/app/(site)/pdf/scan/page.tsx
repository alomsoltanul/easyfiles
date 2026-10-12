import PdfScanner from '@/components/PdfScanner';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PdfScanPage() {
  return (
    <ToolLayout
      title="Scan to PDF"
      description="Take a photo of any document, enhance it, run OCR, and save as a PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All scanning and OCR happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Auto Enhancement', description: 'Increases contrast, sharpens text, and applies grayscale for readability.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'OCR Text Recognition', description: 'Extracts text from your document image using Tesseract.js engine.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/scan">
        <PdfScanner />
      </ToolGate>
    </ToolLayout>
  );
}
