import { Archivo } from 'next/font/google';
import PdfEditor from '@/components/PdfEditor';
import ToolGate from '@/components/ToolGate';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'Edit PDF Text Online — Rewrite, Delete and Reflow',
  description:
    'Edit the text already inside a PDF: click any paragraph, heading or table cell to retype or delete it, and the column reflows around your change. Add text, images, shapes and pages too. Runs entirely in your browser — nothing is uploaded.',
};

export const dynamic = 'force-dynamic';

export default function PdfEditPage() {
  return (
    <div className={`${archivo.className} bg-[#f3f2f2] text-[#201e1d] antialiased`}>
      <ToolGate slug="/pdf/edit">
        <PdfEditor />
      </ToolGate>
    </div>
  );
}
