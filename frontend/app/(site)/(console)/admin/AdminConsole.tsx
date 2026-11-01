'use client';

import { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { api, ApiError, useApi } from '@/lib/api';
import { ROLE_META } from '@/lib/constants';
import { useSession } from '@/lib/session';
import type { Health, MeshNode, Role, User } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';
import { Pill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingRows, SourceTag } from '@/components/ui/DataState';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader, Panel, Section, Stat } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';

const ROLES = Object.keys(ROLE_META) as Role[];
const ELEVATED: Role[] = ['NGO_MEMBER', 'INCIDENT_ADMIN'];

const DB_STATUS: Record<Health['database'], { tone: 'good' | 'warn' | 'neutral'; label: string; explain: string }> = {
  ONLINE: { tone: 'good', label: 'Database online',
    explain: 'Reads and writes go to PostgreSQL. Mesh reports are stored durably and gateways receive confirmed acknowledgements.' },
  DEGRADED: { tone: 'warn', label: 'Database unreachable',
    explain: 'A database is configured but not responding. Screens are showing the cached dataset, and mesh gateways are told to keep reports in their outbox and retry. Check the database project and its connection string (DATABASE_URL or DB_URL).' },
  FALLBACK: { tone: 'neutral', label: 'No database configured',
    explain: 'No database connection string (DATABASE_URL or DB_URL) is set, so the platform runs on its built-in demonstration dataset. New accounts and reports live in memory and disappear on restart.' },
};

function HealthPanel() {
  const health = useApi<Health>('/api/health', { refreshMs: 60_000 });
  if (health.loading && !health.data) return <LoadingRows rows={1} />;
  if (health.error) return <ErrorState message={`The API did not answer: ${health.error.message}`} onRetry={health.reload} />;
  const h = health.data!;
  const db = DB_STATUS[h.database];
  return (
    <Panel className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={db.tone} dot>{db.label}</Pill>
          <Pill tone={h.ml_inference === 'ONLINE' ? 'good' : 'bad'} dot>Inference {h.ml_inference === 'ONLINE' ? 'online' : 'offline'}</Pill>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-sand">{db.explain}</p>
        <Button size="sm" variant="ghost" onClick={health.reload}><RotateCw className="h-3.5 w-3.5" aria-hidden />Check again</Button>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Stat label="Inference self-test" value={<>{h.inference_selftest_ms.toFixed(1)}<span className="ml-1 font-sans text-sm text-stone">ms</span></>}
          note="Surge model and Laya triage, end to end" />
        <Stat label="API version" value={h.version} note={h.system.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} />
      </div>
    </Panel>
  );
}

function UsersPanel() {
  const { user: me } = useSession();
  const toast = useToast();
  const users = useApi<User[]>('/api/admin/users');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const update = async (u: User, fields: { role: Role; is_verified?: boolean }, message: string) => {
    setBusy(u.id);
    try {
      const updated = await api.patch<User>(`/api/admin/users/${u.id}`, fields);
      users.mutate((list) => list?.map((x) => (x.id === u.id ? updated : x)));
      toast(message);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update this account.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const pending = useMemo(() => (users.data ?? []).filter((u) => ELEVATED.includes(u.role) && !u.is_verified && u.onboarded), [users.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? []).filter((u) => !q || `${u.name} ${u.email} ${u.state_district ?? ''}`.toLowerCase().includes(q));
  }, [users.data, query]);

  if (users.loading && !users.data) return <Section title="Accounts"><LoadingRows /></Section>;
  if (users.error) return <Section title="Accounts"><ErrorState message={users.error.message} onRetry={users.reload} /></Section>;

  return (
    <>
      <Section title="Waiting for verification"
        description="NGO and command accounts can't use the command hub until you confirm who they are. Check the agency details they submitted before approving.">
        {pending.length === 0 ? (
          <EmptyState title="No one is waiting" body="New NGO and incident-command sign-ups will appear here." />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {pending.map((u) => {
              const details = Object.entries(u.profile_data ?? {}).filter(([, v]) => v !== '' && v != null).slice(0, 4);
              return (
                <li key={u.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-serif text-xl text-ivory">{u.name}</p>
                    <p className="text-sm text-stone">{ROLE_META[u.role].label} · {u.email}{u.state_district ? ` · ${u.state_district}` : ''}</p>
                    {details.length > 0 && (
                      <p className="text-xs text-sand">
                        {details.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" loading={busy === u.id} onClick={() => update(u, { role: u.role, is_verified: true }, `${u.name} is verified`)}>Approve</Button>
                    <Button size="sm" variant="secondary" disabled={busy === u.id}
                      onClick={() => update(u, { role: 'CITIZEN', is_verified: false }, `${u.name} moved to citizen access`)}>Decline</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Accounts" description="Change a role or revoke verification. Changes apply the next time the person signs in."
        actions={<div className="flex items-center gap-4"><SourceTag source={users.source} />
          <Input aria-label="Search accounts" placeholder="Search name, email or district" value={query}
            onChange={(e) => setQuery(e.target.value)} className="h-9 w-64 text-sm" /></div>}>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs text-stone">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Person</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Verified</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((u) => (
                <tr key={u.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="text-ivory">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-stone">(you)</span>}</p>
                    <p className="text-xs text-stone">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select aria-label={`Role for ${u.name}`} value={u.role} disabled={busy === u.id || u.id === me?.id}
                      onChange={(e) => update(u, { role: e.target.value as Role }, `${u.name} is now ${ROLE_META[e.target.value as Role].label.toLowerCase()}`)}
                      className="h-9 w-48 text-sm">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sand">
                      <input type="checkbox" checked={u.is_verified} disabled={busy === u.id || u.id === me?.id}
                        onChange={(e) => update(u, { role: u.role, is_verified: e.target.checked },
                          e.target.checked ? `${u.name} is verified` : `Verification removed for ${u.name}`)}
                        className="h-4 w-4 accent-[rgb(212,180,131)]" />
                      {u.is_verified ? 'Yes' : 'No'}
                    </label>
                  </td>
                  <td className="px-4 py-3 text-stone">{timeAgo(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="p-6 text-sm text-stone">No accounts match “{query}”.</p>}
        </div>
      </Section>
    </>
  );
}

function NodesPanel() {
  const nodes = useApi<MeshNode[]>('/api/mesh/nodes', { refreshMs: 30_000 });
  const active = (nodes.data ?? []).filter((n) => n.active).length;
  return (
    <Section title="Mesh node liveness"
      description="A node counts as inactive when no heartbeat or relayed packet has reached the server for 30 minutes."
      actions={<SourceTag source={nodes.source} />}>
      {nodes.loading && !nodes.data ? <LoadingRows rows={2} />
        : nodes.error ? <ErrorState message={nodes.error.message} onRetry={nodes.reload} />
        : !nodes.data?.length ? <EmptyState title="No mesh nodes yet" body="Nodes register automatically the first time a gateway syncs their reports." />
        : (
          <>
            <p className="mb-4 text-sm text-sand"><span className="numeral text-2xl">{active}</span> of {nodes.data.length} nodes active</p>
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-line text-xs text-stone">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Node</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Battery</th>
                    <th scope="col" className="px-4 py-3 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {nodes.data.map((n) => (
                    <tr key={n.id}>
                      <td className="px-4 py-3"><span className="code text-sand">{n.node_uuid}</span></td>
                      <td className="px-4 py-3"><Pill tone={n.active ? 'good' : 'neutral'} dot>{n.active ? 'Active' : 'Inactive'}</Pill></td>
                      <td className="px-4 py-3">
                        {n.battery_level == null ? <span className="text-stone">Unknown</span> : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
                              <span className={cn('block h-full rounded-full', n.battery_level < 25 ? 'bg-critical' : n.battery_level < 50 ? 'bg-moderate' : 'bg-low')}
                                style={{ width: `${Math.max(4, n.battery_level)}%` }} />
                            </span>
                            <span className="data text-xs text-sand">{Math.round(n.battery_level)}%</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone">{timeAgo(n.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </Section>
  );
}

export default function AdminConsole() {
  return (
    <>
      <PageHeader label="Incident command" title="Administration"
        lede="System health, account verification and the mesh network at a glance." />
      <div className="page"><HealthPanel /></div>
      <UsersPanel />
      <NodesPanel />
    </>
  );
}
