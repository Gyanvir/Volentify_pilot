'use client';

import dynamic from 'next/dynamic';

const TacticalMap = dynamic(() => import('@/components/map/TacticalMap'), { ssr: false });

export default function MapScreen({ incident }: { incident?: string }) {
  return (
    <main className="relative h-[calc(100dvh-4rem)] w-full">
      <h1 className="sr-only">Tactical map</h1>
      <TacticalMap variant="full" focusDisasterId={incident} className="h-full w-full" />
    </main>
  );
}
