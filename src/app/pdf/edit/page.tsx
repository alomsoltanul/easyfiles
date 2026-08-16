import { Archivo } from 'next/font/google';
import PdfEditor from '@/components/PdfEditor';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'Edit PDF — Text, Images, Shapes and Pages',
  description:
    'Edit a PDF in your browser: add and restyle text, place images, draw, highlight, reorder or delete pages, then export — flattened or fully editable. Nothing is uploaded.',
};

export const dynamic = 'force-dynamic';

export default function PdfEditPage() {
  return (
    <div className={`${archivo.className} bg-[#f3f2f2] text-[#201e1d] antialiased`}>
      <PdfEditor />
    </div>
  );
}
