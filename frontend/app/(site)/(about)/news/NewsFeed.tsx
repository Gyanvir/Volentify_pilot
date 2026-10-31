'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useApi } from '@/lib/api';
import type { Alert, Bulletin } from '@/lib/types';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { Section } from '@/components/ui/Page';
import { Pill, SeverityBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingRows, SourceTag } from '@/components/ui/DataState';

interface Feed { source: string; mode: 'LIVE' | 'DEMO'; items: Bulletin[] }

export default function NewsFeed() {
  const alerts = useApi<Alert[]>('/api/alerts?limit=12', { refreshMs: 120_000 });
  const feed = useApi<Feed>('/api/bhuvan/bulletins', { refreshMs: 300_000 });

  return (
    <div className="page grid gap-12 pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-labelledby="advisories">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="advisories" className="text-[2rem]">Volentify advisories</h2>
          <SourceTag source={alerts.source} />
        </div>
        {alerts.loading ? <LoadingRows rows={4} /> : alerts.error ? <ErrorState message={alerts.error.message} onRetry={alerts.reload} />
          : !alerts.data?.length ? <EmptyState title="No advisories issued" /> : (
            <div className="divide-y divide-line border-y border-line">
              {alerts.data.map((a) => (
                <article key={a.id} className="space-y-2 py-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone">
                    <SeverityBadge level={a.level} />
                    <span>{a.category} · {a.state}</span>
                    <span className="code">{timeAgo(a.created_at)}</span>
                  </div>
                  <h3 className="text-[1.75rem] leading-snug">{a.title}</h3>
                  <p className="max-w-[68ch] leading-relaxed text-sand">{a.description}</p>
                  <p className="max-w-[68ch] leading-relaxed text-stone"><span className="text-ivory">Advice:</span> {a.advisory}</p>
                  {a.disaster_id && <Link href={`/disasters/${a.disaster_id}`} className="link text-sm">Open the incident dossier</Link>}
                </article>
              ))}
            </div>
          )}
      </section>

      <section aria-labelledby="bulletins">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="bulletins" className="text-[2rem]">Official bulletins</h2>
          {feed.data && <Pill tone={feed.data.mode === 'LIVE' ? 'good' : 'warn'} dot>{feed.data.mode === 'LIVE' ? 'SACHET live' : 'SACHET offline'}</Pill>}
        </div>
        {feed.loading ? <LoadingRows rows={5} /> : feed.error ? <ErrorState message={feed.error.message} onRetry={feed.reload} /> : (
          <ul className="space-y-3">
            {(feed.data?.items ?? []).slice(0, 12).map((b, i) => (
              <li key={`${b.title}-${i}`} className="panel space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge level={b.severity} />
                  <span className="code">{formatDateTime(b.published_at)}</span>
                </div>
                <p className="text-sm leading-snug text-ivory">{b.title}</p>
                <p className="flex items-center justify-between text-xs text-stone">
                  {b.source}
                  {b.link && <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ivory">Read <ExternalLink className="h-3 w-3" aria-hidden /></a>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
