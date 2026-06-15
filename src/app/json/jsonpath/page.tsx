import JsonPath from '@/components/JsonPath';
import ToolLayout from '@/components/ToolLayout';
import InfoCards, { PrivacyIcon, SpeedIcon } from '@/components/InfoCards';

export default function JsonPathPage() {
  return (
    <ToolLayout
      title="JSONPath Evaluator"
      description="Query and filter JSON data using JSONPath expressions"
      infoCards={
        <InfoCards cards={[
          { color: 'blue', icon: <PrivacyIcon />, title: 'Private & Secure', description: 'All evaluation happens in your browser. Data never leaves your device.' },
          { color: 'violet', icon: <SpeedIcon />, title: 'Powerful Queries', description: 'Use dot notation, bracket notation, wildcards, and deep scan.' },
          { color: 'emerald', icon: <SpeedIcon />, title: 'Match Count', description: 'See how many results matched your JSONPath expression.' },
        ]} />
      }
    >
      <JsonPath />
    </ToolLayout>
  );
}
