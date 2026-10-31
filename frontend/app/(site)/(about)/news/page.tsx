import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Page';
import NewsFeed from './NewsFeed';

export const metadata: Metadata = { title: 'Situation reports' };

export default function NewsPage() {
  return (
    <>
      <PageHeader
        label="Situation reports"
        title="What authorities are saying, as they say it."
        lede="Advisories broadcast on Volentify alongside the official CAP bulletins published through NDMA SACHET."
      />
      <NewsFeed />
    </>
  );
}
