'use client';

import { useMemo, useState } from 'react';
import { Navigation, Phone, Search } from 'lucide-react';
import { useApi } from '@/lib/api';
import type { Resources } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/DataState';
import { PageHeader, Section } from '@/components/ui/Page';

const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

function DirectionsLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a href={directions(lat, lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[0.8125rem] text-sand hover:text-ivory">
      <Navigation className="h-3.5 w-3.5" aria-hidden />Directions
    </a>
  );
}

export default function ResourceDirectory() {
  const { data, error, loading, reload } = useApi<Resources>('/api/resources');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const match = (...parts: (string | number)[]) => !term || parts.join(' ').toLowerCase().includes(term);

  const hotlines = useMemo(() => data?.hotlines ?? [], [data]);
  const hospitals = (data?.hospitals ?? []).filter((h) => match(h.name, h.kind, h.address, h.trauma_level));
  const shelters = (data?.shelters ?? []).filter((s) => match(s.name, s.address, s.incharge, ...s.facilities));
  const nothing = data && term && !hospitals.length && !shelters.length;

  return (
    <>
      <PageHeader
        label="Emergency resources"
        title="Help, close at hand"
        lede="Helplines, hospitals with intensive-care capacity and relief shelters near active incidents. Capacity figures update as facilities report in."
      />

      <Section className="pt-0">
        <h2 className="sr-only">Helplines</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          {(hotlines.length ? hotlines : Array.from({ length: 8 }, () => null)).map((h, i) => (
            <li key={h?.number ?? i} className="bg-ink">
              {h ? (
                <a href={`tel:${h.number.replace(/[^\d+]/g, '')}`} className="group flex h-full flex-col justify-between gap-3 p-5 transition-colors hover:bg-ink-900">
                  <span className="text-[0.8125rem] text-stone">{h.label}</span>
                  <span className={cn('numeral flex items-center gap-2 text-3xl', h.number === '112' && 'text-critical')}>
                    {h.number}<Phone className="h-4 w-4 text-ash transition-colors group-hover:text-signal" aria-hidden />
                  </span>
                </a>
              ) : <div className="h-24 animate-pulse bg-ink-900" />}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Hospitals and shelters">
        <div className="mb-8 flex h-12 max-w-xl items-center gap-2.5 rounded-xl border border-line bg-ink-800 px-4 focus-within:border-signal/60">
          <Search className="h-4 w-4 text-stone" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, facility or person in charge"
            aria-label="Search hospitals and shelters" className="h-full w-full bg-transparent text-[0.9375rem] text-ivory placeholder:text-ash focus:outline-none" />
        </div>

        {loading && !data ? <LoadingRows rows={4} />
          : error ? <ErrorState message={error.message} onRetry={reload} />
          : nothing ? <EmptyState title={`Nothing matches “${q}”`} body="Try a city or district name." />
          : (
            <div className="grid gap-12 lg:grid-cols-2">
              <section aria-labelledby="hospitals">
                <h3 id="hospitals" className="mb-4 text-2xl">Hospitals <span className="font-sans text-sm text-stone">{hospitals.length}</span></h3>
                <ul className="divide-y divide-line border-y border-line">
                  {hospitals.map((h) => {
                    const scarce = h.icu_available / h.icu_beds < 0.12;
                    return (
                      <li key={h.id} className="space-y-2 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[0.9375rem] text-ivory">{h.name}</p>
                            <p className="text-xs text-stone">{h.kind} · {h.trauma_level} trauma</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('numeral text-2xl', scarce ? 'text-high' : 'text-ivory')}>{h.icu_available}<span className="font-sans text-sm text-stone"> / {h.icu_beds}</span></p>
                            <p className="text-xs text-stone">ICU beds free</p>
                          </div>
                        </div>
                        <p className="text-[0.8125rem] text-sand">{h.address}</p>
                        <div className="flex gap-5 pt-1">
                          <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ivory hover:text-signal"><Phone className="h-3.5 w-3.5" aria-hidden />{h.phone}</a>
                          <DirectionsLink lat={h.lat} lng={h.lng} />
                        </div>
                      </li>
                    );
                  })}
                  {!hospitals.length && <li className="py-6 text-sm text-stone">No hospitals match.</li>}
                </ul>
              </section>

              <section aria-labelledby="shelters">
                <h3 id="shelters" className="mb-4 text-2xl">Relief shelters <span className="font-sans text-sm text-stone">{shelters.length}</span></h3>
                <ul className="divide-y divide-line border-y border-line">
                  {shelters.map((s) => {
                    const ratio = s.occupancy / s.capacity;
                    return (
                      <li key={s.id} className="space-y-2.5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[0.9375rem] text-ivory">{s.name}</p>
                            <p className="text-xs text-stone">In charge: {s.incharge}</p>
                          </div>
                          {ratio >= 0.9 ? <Pill tone="bad">Nearly full</Pill> : ratio >= 0.7 ? <Pill tone="warn">Filling</Pill> : <Pill tone="good">Space available</Pill>}
                        </div>
                        <div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700" role="meter" aria-valuemin={0} aria-valuemax={s.capacity} aria-valuenow={s.occupancy} aria-label={`${s.name} occupancy`}>
                            <div className={cn('h-full rounded-full', ratio >= 0.9 ? 'bg-critical' : ratio >= 0.7 ? 'bg-high' : 'bg-info')} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                          </div>
                          <p className="data mt-1.5 text-xs text-stone">{s.occupancy} of {s.capacity} places taken</p>
                        </div>
                        <p className="text-[0.8125rem] text-sand">{s.address} · {s.facilities.join(', ')}</p>
                        <DirectionsLink lat={s.lat} lng={s.lng} />
                      </li>
                    );
                  })}
                  {!shelters.length && <li className="py-6 text-sm text-stone">No shelters match.</li>}
                </ul>
              </section>
            </div>
          )}
      </Section>
    </>
  );
}
