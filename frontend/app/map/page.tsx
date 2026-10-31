import type { Metadata } from 'next';
import MapScreen from './MapScreen';

export const metadata: Metadata = { title: 'Tactical map' };

export default async function MapPage({ searchParams }: { searchParams: Promise<{ incident?: string }> }) {
  const { incident } = await searchParams;
  return <MapScreen incident={incident} />;
}
