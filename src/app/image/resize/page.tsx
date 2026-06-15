import ImageResizer from '@/components/ImageResizer';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function ImageResizePage() {
  return (
    <ToolLayout
      title="Image Resizer"
      description="Change image dimensions with preset sizes or custom width and height"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All resizing happens in your browser. Files never leave your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Presets Included', description: 'Quick social media, email, and thumbnail sizes ready to use.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Aspect Ratio Lock', description: 'Keep proportions intact with ratio-locked width and height editing.' },
        ]} />
      }
    >
      <ImageResizer />
    </ToolLayout>
  );
}
