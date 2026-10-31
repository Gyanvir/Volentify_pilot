'use client';

import { useMemo } from 'react';
import { useApi } from '@/lib/api';
import { MESH_PRIORITY_HEX, SEVERITY_META } from '@/lib/constants';
import type { Disaster, MeshEvent, MeshPriority, Severity, Task, TaskStatus, Volunteer } from '@/lib/types';
import { timeAgo, titleCase } from '@/lib/utils';
import { Section, Stat } from '@/components/ui/Page';
import { ErrorState, LoadingRows, SourceTag } from '@/components/ui/DataState';
import { ChartCard, Columns, HBar, HBarPair, SERIES, StatusBar } from './charts';

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
const PRIORITIES: MeshPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES: TaskStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
}

export default function AnalyticsBoard() {
  const disasters = useApi<Disaster[]>('/api/disasters', { refreshMs: 120_000 });
  const tasks = useApi<Task[]>('/api/tasks', { refreshMs: 60_000 });
  const volunteers = useApi<Volunteer[]>('/api/volunteers?availability=ALL', { refreshMs: 60_000 });
  const mesh = useApi<MeshEvent[]>('/api/mesh/events?limit=500', { refreshMs: 60_000 });

  const view = useMemo(() => {
    const d = disasters.data ?? [], t = tasks.data ?? [], v = volunteers.data ?? [], m = mesh.data ?? [];
    const byCategory = [...countBy(d, (x) => x.category)].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const bySeverity = countBy(d, (x) => x.severity);
    const byStatus = countBy(t, (x) => x.status);

    const open = t.filter((x) => x.status === 'OPEN');
    const available = v.filter((x) => x.availability === 'AVAILABLE');
    const skills = [...new Set(open.map((x) => x.required_skill))];
    const demand = skills.map((skill) => ({
      label: skill,
      needed: open.filter((x) => x.required_skill === skill).reduce((s, x) => s + x.quantity_needed, 0),
      available: available.filter((x) => x.skills.includes(skill)).length,
    })).sort((a, b) => (b.needed - b.available) - (a.needed - a.available));

    const now = Date.now();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const start = now - (24 - i) * 3_600_000;
      return {
        label: new Date(start + 3_600_000).toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false }) + 'h',
        value: m.filter((e) => { const ts = Date.parse(e.observed_at); return ts >= start && ts < start + 3_600_000; }).length,
      };
    });
    const byPriority = countBy(m, (x) => x.priority);
    const unreviewed = m.filter((x) => x.review_status === 'UNREVIEWED');
    const oldest = unreviewed.reduce<string | null>((o, e) => (!o || e.received_at < o ? e.received_at : o), null);
    return { byCategory, bySeverity, byStatus, demand, hours, byPriority, unreviewed, oldest, m, d, t, v, available, open };
  }, [disasters.data, tasks.data, volunteers.data, mesh.data]);

  const loading = disasters.loading || tasks.loading || volunteers.loading || mesh.loading;
  const error = disasters.error || tasks.error || volunteers.error || mesh.error;
  if (loading) return <Section><LoadingRows rows={4} /></Section>;
  if (error) return <Section><ErrorState message={error.message} onRetry={() => { disasters.reload(); tasks.reload(); volunteers.reload(); mesh.reload(); }} /></Section>;

  const shortfall = view.demand.reduce((s, x) => s + Math.max(0, x.needed - x.available), 0);

  return (
    <>
      <section className="page pb-6">
        <dl className="grid grid-cols-2 gap-8 border-y border-line py-8 lg:grid-cols-4">
          <Stat label="Incidents tracked" value={view.d.length} note={`${view.bySeverity.get('CRITICAL') ?? 0} critical`} />
          <Stat label="Open missions" value={view.open.length} note={`${view.open.reduce((s, x) => s + x.quantity_needed, 0)} responder slots`} />
          <Stat label="Responders available" value={view.available.length} note={`of ${view.v.length} registered`} />
          <Stat label="Unreviewed mesh reports" value={view.unreviewed.length} note={view.oldest ? `oldest received ${timeAgo(view.oldest)}` : 'backlog clear'} />
        </dl>
        <SourceTag source={disasters.source} className="mt-3" />
      </section>

      <section className="page grid gap-4 py-6 lg:grid-cols-2">
        <ChartCard title="Incidents by hazard" note="Count of incidents currently in the register."
          table={{ head: ['Hazard', 'Incidents'], rows: view.byCategory.map((x) => [x.label, x.value]) }}>
          <HBar data={view.byCategory} name="incidents" />
        </ChartCard>
        <ChartCard title="Incidents by severity" note="Highest declared severity for each incident."
          table={{ head: ['Severity', 'Incidents'], rows: SEVERITIES.map((s) => [SEVERITY_META[s].label, view.bySeverity.get(s) ?? 0]) }}>
          <div className="flex h-full flex-col justify-center py-4">
            <StatusBar parts={SEVERITIES.map((s) => ({ label: SEVERITY_META[s].label, value: view.bySeverity.get(s) ?? 0, color: SEVERITY_META[s].hex }))} />
          </div>
        </ChartCard>

        <ChartCard className="lg:col-span-2" title="Skills needed against responders available"
          note={shortfall > 0 ? `Open missions are short of ${shortfall} qualified responder${shortfall === 1 ? '' : 's'} across all skills.` : 'Every open mission has enough available, qualified responders.'}
          table={{ head: ['Skill', 'Slots needed', 'Available with skill'], rows: view.demand.map((x) => [x.label, x.needed, x.available]) }}>
          {view.demand.length ? (
            <HBarPair data={view.demand} a={{ key: 'needed', name: 'Responder slots needed', color: SERIES.demand }}
              b={{ key: 'available', name: 'Available with this skill', color: SERIES.supply }} />
          ) : <p className="py-10 text-center text-sm text-stone">No open missions.</p>}
        </ChartCard>

        <ChartCard title="Missions by status"
          table={{ head: ['Status', 'Missions'], rows: STATUSES.map((s) => [titleCase(s), view.byStatus.get(s) ?? 0]) }}>
          <HBar data={STATUSES.map((s) => ({ label: titleCase(s), value: view.byStatus.get(s) ?? 0 }))} name="missions" />
        </ChartCard>
        <ChartCard title="Mesh reports by priority" note={`${view.m.length} reports in the system.`}
          table={{ head: ['Priority', 'Reports'], rows: PRIORITIES.map((p) => [titleCase(p), view.byPriority.get(p) ?? 0]) }}>
          <div className="flex h-full flex-col justify-center py-4">
            <StatusBar parts={PRIORITIES.map((p) => ({ label: titleCase(p), value: view.byPriority.get(p) ?? 0, color: MESH_PRIORITY_HEX[p] }))} />
          </div>
        </ChartCard>

        <ChartCard className="lg:col-span-2" title="Mesh reports observed per hour, last 24 hours"
          note="Grouped by when the field observation was made, not when it reached the server — relayed reports can arrive hours later."
          table={{ head: ['Hour ending', 'Reports'], rows: view.hours.map((h) => [h.label, h.value]) }}>
          <Columns data={view.hours} name="reports" />
        </ChartCard>
      </section>
    </>
  );
}
