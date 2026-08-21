import ImageConverter from '@/components/ImageConverter';
import ToolGate from '@/components/ToolGate';

export default function ImageConvertPage() {
  return (
    <ToolGate slug="/image/convert">
      <ImageConverter />
    </ToolGate>
  );
}
