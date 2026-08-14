import WebpConverter from '@/components/WebpConverter';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'PNG to WebP — High Quality, Transparency Preserved',
  description:
    'Convert PNG images to WebP in your browser. Lossless mode, alpha transparency preserved, batch conversion, and ZIP download. Nothing is uploaded.',
};

export default function PngToWebpPage() {
  return (
    <ToolLayout
      title="PNG to WebP"
      description="Convert PNG images to WebP with lossless mode and full alpha transparency — single or bulk"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Encoding runs in your browser. PNGs never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Transparency Safe', description: 'Alpha channel is kept intact, or flatten to white if you prefer.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Lossless Option', description: 'Pixel-identical WebP that is still smaller than the source PNG.' },
        ]} />
      }
    >
      <WebpConverter source="png" />
    </ToolLayout>
  );
}
