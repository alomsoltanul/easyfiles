import PdfToMarkdown from '@/components/PdfToMarkdown';
import ToolLayout from '@/components/ToolLayout';
import ToolGate from '@/components/ToolGate';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'PDF to Markdown — Headings, Lists and Tables Preserved',
  description: 'Convert PDF to Markdown in your browser. Detects headings, bullet and numbered lists, tables, bold and italic, and rejoins wrapped lines.',
};

export const dynamic = 'force-dynamic';

export default function PdfToMarkdownPage() {
  return (
    <ToolLayout
      title="PDF to Markdown"
      description="Turn a PDF into clean Markdown with headings, lists and tables preserved"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'Text extraction happens locally — nothing is sent to a server.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Structure Aware', description: 'Headings, lists, tables and emphasis are reconstructed, not flattened.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'LLM Ready', description: 'Clean Markdown to paste into notes, docs or a model prompt.' },
        ]} />
      }
    >
      <ToolGate slug="/pdf/to-markdown">
        <PdfToMarkdown />
      </ToolGate>
    </ToolLayout>
  );
}
