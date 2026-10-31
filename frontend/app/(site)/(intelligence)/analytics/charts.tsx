'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { cn } from '@/lib/utils';

export const AXIS = { fill: '#8d887e', fontSize: 12 };
export const GRID = 'rgba(244,241,234,0.08)';
export const SERIES = { primary: '#d4b483', signal: '#ff6b00', demand: '#f08a3c', supply: '#6fa3e0' };

export function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-ink-800 px-3 py-2 text-xs shadow-float">
      <p className="mb-1 text-stone">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="font-medium text-ivory tabular-nums">{p.value}</span>
          <span className="text-stone">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({ title, note, children, table, className }: {
  title: string; note?: string; children: React.ReactNode; table: { head: string[]; rows: (string | number)[][] }; className?: string;
}) {
  return (
    <figure className={cn('panel flex flex-col gap-4 p-5 sm:p-6', className)}>
      <figcaption className="space-y-1">
        <h3 className="text-2xl">{title}</h3>
        {note && <p className="text-sm text-stone">{note}</p>}
      </figcaption>
      <div className="min-h-0 flex-1">{children}</div>
      <details className="text-sm">
        <summary className="cursor-pointer text-stone hover:text-sand">View as table</summary>
        <table className="mt-3 w-full text-left text-[0.8125rem]">
          <thead><tr className="text-stone">{table.head.map((h) => <th key={h} className="pb-1.5 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cn('py-1.5', j > 0 && 'tabular-nums text-ivory')}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Single-series horizontal bars. */
export function HBar({ data, name, color = SERIES.primary, height }: { data: { label: string; value: number }[]; name: string; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(140, data.length * 38 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={150} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(244,241,234,0.04)' }} />
        <Bar dataKey="value" name={name} fill={color} radius={[0, 4, 4, 0]} barSize={16}
          label={{ position: 'right', fill: '#c9c4b8', fontSize: 12 }} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two-series grouped horizontal bars (demand vs supply). */
export function HBarPair({ data, a, b }: { data: Record<string, string | number>[]; a: { key: string; name: string; color: string }; b: { key: string; name: string; color: string } }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 52 + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={160} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(244,241,234,0.04)' }} />
        <Legend verticalAlign="top" align="left" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#c9c4b8', paddingBottom: 8 }} />
        <Bar dataKey={a.key} name={a.name} fill={a.color} radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
        <Bar dataKey={b.key} name={b.name} fill={b.color} radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-series columns over a time axis. */
export function Columns({ data, name, color = SERIES.signal }: { data: { label: string; value: number }[]; name: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={3} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(244,241,234,0.04)' }} />
        <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Proportional status bar with labelled legend (status colours never stand alone). */
export function StatusBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="space-y-4">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total === 0 ? <div className="h-full w-full bg-ink-700" /> : parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            <span className="text-stone">{p.label}</span>
            <span className="ml-auto tabular-nums text-ivory sm:ml-1">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
