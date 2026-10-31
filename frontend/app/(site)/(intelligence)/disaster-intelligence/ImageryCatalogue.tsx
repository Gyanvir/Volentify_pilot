'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import type { ImageryLayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Section } from '@/components/ui/Page';
import { ErrorState, Skeleton } from '@/components/ui/DataState';

const ImageryPreview = dynamic(() => import('./ImageryPreview'), {
  ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-ink-800" aria-hidden />,
});

/** Resolve tile URLs, including RainViewer's frame index which changes every ten minutes. */
function useTiles(layer: ImageryLayer | null): { tiles: string[]; frameTime: string | null } {
  const [state, setState] = useState<{ tiles: string[]; frameTime: string | null }>({ tiles: [], frameTime: null });
  useEffect(() => {
    if (!layer) return;
    if (!layer.dynamic) { setState({ tiles: layer.tiles, frameTime: null }); return; }
    let cancelled = false;
    setState({ tiles: [], frameTime: null });
    fetch(layer.dynamic).then((r) => r.json()).then((idx: { host: string; radar: { past: { time: number; path: string }[] } }) => {
      const frame = idx.radar.past.at(-1);
      if (!cancelled && frame) {
        setState({ tiles: [`${idx.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`], frameTime: new Date(frame.time * 1000).toISOString() });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [layer]);
  return state;
}

export default function ImageryCatalogue() {
  const { data, error, loading, reload } = useApi<ImageryLayer[]>('/api/bhuvan/layers');
  const [activeId, setActiveId] = useState<string | null>(null);
  const layers = data ?? [];
  const active = layers.find((l) => l.id === activeId) ?? layers[0] ?? null;
  const { tiles, frameTime } = useTiles(active);

  return (
    <Section title="Imagery layers" description="Pick a layer to preview it over the Bay of Bengal. Every layer here is also available as a base map on the tactical map.">
      {error ? <ErrorState message={error.message} onRetry={reload} /> : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <ul className="space-y-2" aria-label="Imagery layers">
            {loading && Array.from({ length: 4 }).map((_, i) => <li key={i}><Skeleton className="h-[4.5rem]" /></li>)}
            {layers.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setActiveId(l.id)}
                  aria-pressed={active?.id === l.id}
                  className={cn('w-full rounded-xl border px-4 py-3 text-left transition-colors',
                    active?.id === l.id ? 'border-signal/50 bg-ivory/[0.04]' : 'border-line hover:border-line-strong')}
                >
                  <span className="block text-[0.9375rem] text-ivory">{l.label}</span>
                  <span className="block text-xs text-stone">{l.provider} · {l.cadence}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <div className="h-[24rem] overflow-hidden rounded-2xl border border-line sm:h-[30rem]">
              <ImageryPreview layer={active} tiles={tiles} />
            </div>
            <p className="text-xs text-stone">
              {active?.dynamic
                ? frameTime ? <>Radar frame <span className="code">{new Date(frameTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span> IST. Coverage over India depends on contributing stations.</> : 'Fetching the latest radar frame…'
                : active ? `Maximum detail at zoom ${active.max_zoom}. Daily composites can show cloud and swath gaps.` : null}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}
