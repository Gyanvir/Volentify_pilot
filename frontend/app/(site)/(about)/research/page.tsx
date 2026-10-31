import type { Metadata } from 'next';
import { PageHeader, Section } from '@/components/ui/Page';
import { Pill } from '@/components/ui/Badge';
import { Prose } from '../_components/Prose';

export const metadata: Metadata = { title: 'Research' };

const MODELS = [
  { name: 'Storm-surge & hazard model', target: 'Surge RMSE ±0.28 m · 94.8% accuracy · < 50 ms', detail: 'Eight features: wind, 24 h rainfall, pressure deficit, coordinates, distance to coast, elevation and tidal phase. Ships with a calibrated physical estimator; loads a trained XGBoost booster when one is supplied.' },
  { name: 'Laya multilingual triage', target: '< 35 ms end to end', detail: 'Three tiers: a local router package, a hosted endpoint, and a deterministic lexicon matcher across Indian scripts that always answers in under a millisecond.' },
  { name: 'SitRep language model', target: 'F1 98.1% · 110 ms CPU', detail: 'Multilingual DistilBERT with category, urgency and entity heads, planned as an INT8 ONNX model for future on-device use.' },
  { name: 'Report corroboration', target: 'Clusters within 15 km and 2 h', detail: 'Spatio-temporal clustering with optional Gemini 2.5 Flash merging of corroborated facts and 150-word NDRF briefings.' },
  { name: 'Priority-driven dispatch', target: '< 1 ms · 0% rare-skill squander', detail: 'Greedy lexicographic allocation with skill scarcity, an anti-squander penalty, distance decay and fatigue. Each run reports its own measured latency.' },
];

const PAPERS = [
  { venue: 'Volentify ML Plan, v3.5', year: '2026', title: 'Priority-driven heuristic dispatch for spontaneous volunteers in Indian disaster response', note: 'Sperling heuristic formulation, scoring function and comparison against branch-and-cut MILP allocation.' },
  { venue: 'Volentify ML Plan, v3.5', year: '2026', title: 'Spatial hazard probability from coastal meteorology and elevation', note: 'Feature design and risk thresholds for the storm-surge classifier on North Indian Ocean cyclone tracks.' },
  { venue: 'Volentify Mesh specification', year: '2026', title: 'Store-and-forward reporting over BLE for disaster zones without connectivity', note: 'Event envelope, hop budget, deduplication and idempotent gateway synchronisation.' },
];

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        label="Research"
        title="The methods behind the platform."
        lede="How each model and engine works, and the performance targets set in the product specification."
      />
      <Section title="Models and engines">
        <div className="rounded-2xl border border-gold/25 bg-gold/[0.04] p-4 text-sm leading-relaxed text-sand">
          Figures in this table are <strong className="font-medium text-ivory">targets reported in the Volentify product specification</strong>,
          not independent measurements of this deployment. Live latencies are returned by each API call and shown on the forecasting
          and dispatch pages.
        </div>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {MODELS.map((m) => (
            <div key={m.name} className="grid gap-3 py-6 md:grid-cols-[16rem_1fr_17rem] md:gap-8">
              <h3 className="text-2xl">{m.name}</h3>
              <p className="max-w-[62ch] text-sm leading-relaxed text-stone">{m.detail}</p>
              <p className="text-sm text-ivory md:text-right">{m.target}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Working papers">
        <ul className="grid gap-4 md:grid-cols-3">
          {PAPERS.map((p) => (
            <li key={p.title} className="panel flex flex-col gap-3 p-6">
              <Pill tone="gold" className="w-fit">{p.venue} · {p.year}</Pill>
              <h3 className="text-2xl leading-snug">{p.title}</h3>
              <p className="text-sm leading-relaxed text-stone">{p.note}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Citing Volentify">
        <Prose>
          <p>If you use the platform, data model or dispatch method in your work, please cite the repository:</p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-ink-900 p-4 font-mono text-[0.8125rem] leading-relaxed text-sand">{`@software{volentify_2026,
  title  = {Volentify: Disaster Intelligence, Offline Mesh Coordination and ML Forecasting},
  year   = {2026},
  url    = {https://github.com/thehimanshubansal/Volentify},
  license= {MIT}
}`}</pre>
        </Prose>
      </Section>
    </>
  );
}
