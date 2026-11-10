import { memo } from 'react';
import ChartCard from './ChartCard';
import ChartDataTable from './ChartDataTable';
import { TYPE_STYLE, type TypeStat } from '../data/mock';
import { fmtMoneyCompact } from '../lib/format';

interface TypeMixProps {
  stats: TypeStat[]; // unresolved, detected within selected window
  rangeDays: number;
}

export default memo(function TypeMix({ stats, rangeDays }: TypeMixProps) {
  const totalValue = stats.reduce((a, s) => a + s.value, 0);
  const totalItems = stats.reduce((a, s) => a + s.items, 0);
  const sorted = [...stats].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const shrinkValue = stats
    .filter((s) => s.type === 'Shortage' || s.type === 'Missing')
    .reduce((a, s) => a + s.value, 0);
  const shrinkPct = totalValue > 0 ? (shrinkValue / totalValue) * 100 : 0;

  return (
    <ChartCard
      className="h-full"
      title="Where the variance lives"
      subtitle={`$ at risk by discrepancy type · ${totalItems} unresolved items detected in last ${rangeDays}d`}
      bodyClassName="flex flex-col px-5 pb-5 pt-2"
    >
      {/* 100% stacked composition bar — one shared baseline beats slice angles */}
      <div
        className="flex h-5 w-full gap-[2px] overflow-hidden rounded-md border border-edge bg-edge"
        role="img"
        aria-label={`Composition of unresolved variance value: ${sorted.map((s) => `${s.type} ${totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(0) : 0}%`).join(', ')}`}
      >
        {sorted.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.type}
            className="h-full rounded-[2px] transition-[filter] duration-150 hover:brightness-125"
            style={{ width: `${(s.value / totalValue) * 100}%`, background: TYPE_STYLE[s.type].hex }}
            title={`${s.type} — ${fmtMoneyCompact(s.value)} (${((s.value / totalValue) * 100).toFixed(0)}%)`}
          />
        ))}
      </div>

      <ul className="mt-3 divide-y divide-edge/70">
        {sorted.map((s) => {
          const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
          return (
            <li key={s.type} className="flex items-center gap-2.5 py-[7px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: TYPE_STYLE[s.type].hex }} aria-hidden="true" />
              <span className="w-[92px] shrink-0 text-[12px] font-medium text-text">{s.type}</span>
              <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-panel3" aria-hidden="true">
                <div className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${pct}%`, background: TYPE_STYLE[s.type].hex, opacity: 0.85 }} />
              </div>
              <span className="tnum w-8 shrink-0 text-right font-mono text-[12px] text-dim">{s.items}×</span>
              <span className="tnum w-9 shrink-0 text-right font-mono text-[12px] text-dim">{pct.toFixed(0)}%</span>
              <span className="tnum w-14 shrink-0 text-right font-mono text-[12px] font-semibold text-text">{fmtMoneyCompact(s.value)}</span>
            </li>
          );
        })}
      </ul>
      <p className="pretty mt-2 border-t border-edge/70 pt-2.5 text-[12px] leading-snug text-faint">
        Sorted by $ at risk. Mislocation is relocation cost, not loss; shortage and missing are shrink.
      </p>
      <ChartDataTable
        caption={`Data table (${sorted.length} types)`}
        head={[
          { label: 'Type' },
          { label: 'Items', align: 'right' },
          { label: 'Share', align: 'right' },
          { label: 'Value at risk', align: 'right' },
        ]}
        rows={sorted.map((s) => [
          s.type,
          String(s.items),
          `${totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(0) : 0}%`,
          fmtMoneyCompact(s.value),
        ])}
      />
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-edge/70 pt-3">
        <div className="min-w-0">
          <div className="text-[12px] text-faint">Largest exposure</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="truncate text-[12px] font-semibold text-text">{top.type}</span>
            <span className="tnum shrink-0 font-mono text-[12px] text-dim">{fmtMoneyCompact(top.value)}</span>
          </div>
        </div>
        <div>
          <div className="text-[12px] text-faint">Shrink share</div>
          <div className="mt-0.5 tnum font-mono text-[12px] font-semibold text-bad">{shrinkPct.toFixed(0)}%</div>
        </div>
      </div>
    </ChartCard>
  );
});
