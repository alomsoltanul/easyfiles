import DocConverter from '@/components/DocConverter';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function PowerPointToPdfPage() {
  return (
    <ToolLayout
      title="PowerPoint to PDF"
      description="Convert PPTX slide decks into portable PDF"
      infoCards={
        <InfoCards cards={[
          { color: 'blue',    icon: <PrivacyIcon />, title: 'Private',              description: 'Slides are parsed in-browser — no server round-trip.' },
          { color: 'violet',  icon: <SpeedIcon />,   title: 'One Slide per Page',   description: 'Titles and bullets are preserved on 4:3 slide-sized pages.' },
          { color: 'emerald', icon: <SpeedIcon />,   title: 'Universal',            description: 'PDFs open anywhere, no PowerPoint required.' },
        ]} />
      }
    >
      <DocConverter
        toolType="powerpoint-to-pdf"
        accept=".ppt,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        acceptLabel="PPTX files supported"
        uploadTitle="Drop your PowerPoint here"
        uploadSubtitle="or click to browse — .pptx"
        actionLabel="Convert to PDF"
        successTitle="PowerPoint converted to PDF!"
        filterExt=".ppt,.pptx"
      />
    </ToolLayout>
  );
}
