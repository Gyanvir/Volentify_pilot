import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Page';
import AnalyticsBoard from './AnalyticsBoard';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        label="Analytics"
        title="The operational picture, in numbers."
        lede="Computed live from incidents, missions, responders and mesh reports currently in the system. Nothing here is projected or historical."
      />
      <AnalyticsBoard />
    </>
  );
}
