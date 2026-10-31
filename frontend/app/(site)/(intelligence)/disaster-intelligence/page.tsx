import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Page';
import ImageryCatalogue from './ImageryCatalogue';
import Bulletins from './Bulletins';
import DedupTool from './DedupTool';

export const metadata: Metadata = { title: 'Satellite & bulletins' };

export default function DisasterIntelligencePage() {
  return (
    <>
      <PageHeader
        label="Intelligence"
        title="Satellite imagery, official bulletins and report corroboration."
        lede="Look at the ground from orbit, read the warnings issued by authorities, and collapse a flood of overlapping reports into the incidents behind them."
      />
      <ImageryCatalogue />
      <Bulletins />
      <DedupTool />
    </>
  );
}
