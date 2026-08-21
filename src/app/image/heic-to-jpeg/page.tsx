import HeicConverter from '@/components/HeicConverter';
import ToolGate from '@/components/ToolGate';

export default function HeicToJpegPage() {
  return (
    <ToolGate slug="/image/heic-to-jpeg">
      <HeicConverter
        defaultOutput="image/jpeg"
        title="HEIC to JPEG"
        description="Convert Apple HEIC/HEIF photos to JPEG — single or bulk processing"
      />
    </ToolGate>
  );
}
