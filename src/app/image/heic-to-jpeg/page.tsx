import HeicConverter from '@/components/HeicConverter';

export default function HeicToJpegPage() {
  return (
    <HeicConverter
      defaultOutput="image/jpeg"
      title="HEIC to JPEG"
      description="Convert Apple HEIC/HEIF photos to JPEG — single or bulk processing"
    />
  );
}
