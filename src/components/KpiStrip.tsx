import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { WindowSummary } from '../data/mock';
import { fmtInt, fmtMoneyCompact, fmtSignedPts, fmtSigned, fmtPct } from '../lib/format';
import { useTween } from '../lib/useTween';

const ACCURACY_TARGET = 98.5;

interface KpiStripProps {
  summary: WindowSummary;
  rangeDays: number;
  openCount: number;
  investigatingCount: number;
  criticalCount: number;
  unassignedCount: number;
}

function DeltaChip({ delta, invert = false, suffix = '', render }: { delta: number; invert?: boolean; suffix?: string; render?: (v: number) => string }) {
  const good = invert ? delta < 0 : delta > 0;
  const flat = Math.abs(delta) < 0.005;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? 'text-faint border-edge bg-panel2'
    : good
      ? 'text-good border-good/25 bg-good/[0.07]'
      : 'text-bad border-bad/25 bg-bad/[0.07]';
  const text = render
    ? render(delta)
    : suffix
      ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}${suffix}`
      : fmtSignedPts(delta);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[12px] font-medium tnum ${tone}`}>
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {text}
    </span>
  );
}

function Card({ label, value, footer, title }: { label: string; value: ReactNode; footer: ReactNode; title?: string }) {
  return (
    <div className="panel kpi-card flex min-w-0 flex-col justify-between gap-1.5 p-4" title={title}>
      <span className="text-[12px] font-medium text-dim">{label}</span>
      <div className="tnum font-mono text-[26px] font-medium leading-none tracking-[-0.02em] text-text">{value}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-snug text-faint">{footer}</div>
    </div>
  );
}

export default function KpiStrip({ summary, rangeDays, openCount, investigatingCount, criticalCount, unassignedCount }: KpiStripProps) {
  const accuracy = useTween(summary.accuracy);
  const countsDone = useTween(summary.countsDone);
  const valueImpact = useTween(summary.valueImpact);
  const atRisk = useTween(openCount + investigatingCount);
  const netUnits = useTween(summary.netUnits);

  const completion = summary.completion;
  const completionTone = completion >= 95 ? 'text-good' : completion >= 85 ? 'text-amber' : 'text-bad';
  const netTone = 'text-text';

  return (
    <div className="grid grid-cols-2 gap-3 max-xl:[&>*:last-child]:col-span-2 md:grid-cols-3 xl:grid-cols-5">
      {/* Inventory accuracy — the control metric; window average */}
      <Card
        label={`Accuracy · ${rangeDays}d avg`}
        title={`Mean daily accuracy across the ${rangeDays}d window (system vs blind count). Not the chart endpoint. Prior window = the ${rangeDays}d immediately before it. Target ${ACCURACY_TARGET}%.`}
        value={<>{accuracy.toFixed(2)}<span className="ms-0.5 text-[15px] text-dim">%</span></>}
        footer={
          <>
            <DeltaChip delta={summary.accuracyDelta} />
            <span className="tnum">vs prior {rangeDays}d · target {ACCURACY_TARGET}%</span>
          </>
        }
      />

      {/* Counts completed vs schedule */}
      <Card
        label={`Counts completed · ${rangeDays}d`}
        title={`Counts completed in the ${rangeDays}d window ÷ counts scheduled for it. Bar shows completion vs schedule.`}
        value={fmtInt(countsDone)}
        footer={
          <>
            <span className={`tnum font-mono font-medium ${completionTone}`}>{fmtPct(completion, 0)}</span>
            <span className="tnum">of {fmtInt(summary.countsPlanned)} scheduled</span>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-panel3" role="progressbar" aria-valuenow={Math.round(completion)} aria-valuemin={0} aria-valuemax={100} aria-label="Count completion vs schedule">
              <div className={`h-full rounded-full ${completion >= 95 ? 'bg-good' : completion >= 85 ? 'bg-amber' : 'bg-bad'}`} style={{ width: `${Math.min(100, completion)}%` }} />
            </div>
          </>
        }
      />

      {/* Variance value detected this window */}
      <Card
        label={`Booked variance · ${rangeDays}d`}
        title="Σ variance value booked in the window, shrink + overage (absolute $). Delta vs the prior window; positive means more value at risk, not more profit."
        value={fmtMoneyCompact(valueImpact)}
        footer={
          <>
            <DeltaChip delta={summary.valueDeltaPct} invert suffix="%" />
            <span>vs prior {rangeDays}d · shrink + overage</span>
          </>
        }
      />

      {/* Unresolved snapshot — open + investigating, not the seeded Open status */}
      <Card
        label="Unresolved · now"
        title="Open + Investigating records in the discrepancy queue, excluding Resolved. Snapshot, not a window. Sub-metrics overlap (a Critical can also be Unassigned)."
        value={fmtInt(atRisk)}
        footer={
          <>
            <span className={`tnum font-mono font-medium ${criticalCount > 0 ? 'text-bad' : ''}`}>{criticalCount} critical</span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{investigatingCount} investigating</span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{unassignedCount} unassigned</span>
          </>
        }
      />

      {/* Net units variance — directional, not good/bad */}
      <Card
        label={`Net units · ${rangeDays}d`}
        title={`Σ signed variance units in the ${rangeDays}d window (negative = shortage-leaning). Delta vs the prior window. Sign shows direction, not good/bad.`}
        value={<span className={netTone}>{fmtSigned(netUnits)}</span>}
        footer={
          <>
            <DeltaChip delta={summary.netUnits - summary.netUnitsPrior} render={(v) => fmtSigned(v)} />
            <span>{summary.netUnits < 0 ? 'Shortage-leaning' : 'Overage-leaning'} vs prior</span>
          </>
        }
      />
    </div>
  );
}
