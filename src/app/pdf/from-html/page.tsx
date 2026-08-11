import HtmlToPdf from '@/components/HtmlToPdf';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon, BulkIcon } from '@/components/InfoCards';

export const metadata = {
  title: 'HTML to PDF — Convert a Web Page or Markup',
  description: 'Paste a URL, HTML, or upload an .html file and export a paginated PDF with page size, orientation, margins and smart page breaks.',
};

export const dynamic = 'force-dynamic';

export default function HtmlToPdfPage() {
  return (
    <ToolLayout
      title="HTML to PDF"
      description="Convert a web page, pasted HTML or an .html file into a paginated PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Sanitised Fetch', description: 'Pages are fetched server-side, stripped of scripts, then rendered in a sandbox.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Real Pagination', description: 'Smart page breaks avoid slicing through a line of text.' },
          { color: 'emerald', icon: <BulkIcon />, title: 'Viewport Control', description: 'Render at desktop, tablet or mobile widths to match the layout you want.' },
        ]} />
      }
    >
      <HtmlToPdf />
    </ToolLayout>
  );
}
