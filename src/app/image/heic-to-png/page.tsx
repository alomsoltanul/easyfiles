import HeicConverter from '@/components/HeicConverter';

export default function HeicToPngPage() {
  return (
    <HeicConverter
      defaultOutput="image/png"
      title="HEIC to PNG"
      description="Convert Apple HEIC/HEIF photos to lossless PNG — single or bulk processing"
    />
  );
}
