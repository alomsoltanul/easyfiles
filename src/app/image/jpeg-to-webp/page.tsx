import WebpConverter from '@/components/WebpConverter';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'JPEG to WebP — High Quality Photo Conversion',
  description:
    'Convert JPG/JPEG photos to WebP in your browser. High-quality encoding, EXIF orientation handled, batch conversion, and ZIP download. Nothing is uploaded.',
};

export default function JpegToWebpPage() {
  return (
    <ToolLayout
      title="JPEG to WebP"
      description="Convert JPG/JPEG photos to WebP at high quality — typically 25–35% smaller at the same detail"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Encoding runs in your browser. Photos never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Detail Preserved', description: 'EXIF rotation applied and stepped resampling keeps edges sharp.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Batch + ZIP', description: 'Convert a whole folder at once and grab everything in one ZIP.' },
        ]} />
      }
    >
      <WebpConverter source="jpeg" />
    </ToolLayout>
  );
}
