'use client';

import { ExternalLink } from 'lucide-react';
import { useApi } from '@/lib/api';
import type { Bulletin } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { Section } from '@/components/ui/Page';
import { SeverityBadge, Pill } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/DataState';

interface Feed { source: string; mode: 'LIVE' | 'DEMO'; items: Bulletin[] }

export default function Bulletins() {
  const { data, error, loading, reload } = useApi<Feed>('/api/bhuvan/bulletins', { refreshMs: 300_000 });

  return (
    <Section
      title="Official bulletins"
      description="Common Alerting Protocol warnings published through NDMA’s SACHET system by IMD, CWC, INCOIS and state authorities."
      actions={data && (
        <Pill tone={data.mode === 'LIVE' ? 'good' : 'warn'} dot>
          {data.mode === 'LIVE' ? `Live from ${data.source}` : 'SACHET unreachable — showing Volentify alerts'}
        </Pill>
      )}
    >
      {loading ? <LoadingRows rows={4} /> : error ? <ErrorState message={error.message} onRetry={reload} />
        : !data?.items.length ? <EmptyState title="No bulletins in force" body="Nothing has been issued in the current feed window." /> : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {data.items.slice(0, 15).map((b, i) => (
              <li key={`${b.title}-${i}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-start sm:gap-6">
                <SeverityBadge level={b.severity} className="w-fit" />
                <div className="min-w-0 space-y-1">
                  <p className="text-[0.9375rem] text-ivory">{b.title}</p>
                  {b.description && <p className="line-clamp-2 max-w-[75ch] text-sm leading-relaxed text-stone">{b.description.replace(/<[^>]+>/g, ' ')}</p>}
                  <p className="text-xs text-stone">{b.source} · <span className="code">{formatDateTime(b.published_at)}</span></p>
                </div>
                {b.link && (
                  <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sand hover:text-ivory">
                    Source <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}
