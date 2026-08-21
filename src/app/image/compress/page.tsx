import ImageCompressor from '@/components/ImageCompressor';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export default function ImageCompressPage() {
  return (
    <ToolLayout
      title="Image Compressor"
      description="Reduce image file size while keeping great visual quality"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All compression happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Instant Results', description: 'Optimized canvas-based compression for immediate file size reduction.' },
          { color: 'amber', icon: <BulkIcon />, title: 'Batch Compress', description: 'Upload multiple images at once and compress them all with one click.' },
        ]} />
      }
    >
      <ToolGate slug="/image/compress">
        <ImageCompressor />
      </ToolGate>
    </ToolLayout>
  );
}
