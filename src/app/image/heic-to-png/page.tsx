import HeicConverter from '@/components/HeicConverter';
import ToolGate from '@/components/ToolGate';

export default function HeicToPngPage() {
  return (
    <ToolGate slug="/image/heic-to-png">
      <HeicConverter
        defaultOutput="image/png"
        title="HEIC to PNG"
        description="Convert Apple HEIC/HEIF photos to lossless PNG — single or bulk processing"
      />
    </ToolGate>
  );
}
