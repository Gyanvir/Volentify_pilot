import type { Metadata } from 'next';
import ResourceDirectory from './ResourceDirectory';

export const metadata: Metadata = { title: 'Emergency resources' };

export default function ResourcesPage() {
  return <ResourceDirectory />;
}
