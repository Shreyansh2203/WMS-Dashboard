import ChartCard from './ChartCard';
import ChartDataTable from './ChartDataTable';
import type { ZoneStat } from '../data/mock';
import { fmtMoneyCompact } from '../lib/format';

interface ZoneVarianceProps {
  stats: ZoneStat[]; // unresolved in selected window, sorted by value desc (zero-value zones filtered inside)
  rangeDays: number;
}

export default function ZoneVariance({ stats, rangeDays }: ZoneVarianceProps) {
  const active = stats.filter((z) => z.items > 0);
  const maxSide = Math.max(1, ...active.map((z) => Math.max(z.shortageValue, z.overageValue)));
  const total = active.reduce((a, z) => a + z.value, 0);

  return (
    <ChartCard
      className="h-full"
      title="Variance value by zone"
      subtitle={`Unresolved shrink vs surplus detected in last ${rangeDays}d, diverging from zero`}
      right={
        <div className="flex items-center gap-3 pt-0.5 text-[12px] font-medium text-dim">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-bad" />Shrink</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-[#3987e5]" />Surplus</span>
          <span className="hidden font-mono text-[12px] text-faint sm:inline tnum">Total exposure {fmtMoneyCompact(total)}</span>
        </div>
      }
    >
      <div className="space-y-[7px]" role="img" aria-label="Diverging bar chart of shrink versus surplus value per warehouse zone">
        {active.map((z) => {
          const shortPct = (z.shortageValue / maxSide) * 100;
          const overPct = (z.overageValue / maxSide) * 100;
          return (
            <div
              key={z.zone}
              className="grid grid-cols-[52px_1fr_minmax(56px,auto)] items-center gap-2"
              title={`${z.name} — shrink $${z.shortageValue.toFixed(0)}, surplus $${z.overageValue.toFixed(0)}, ${z.items} items${z.critical ? `, ${z.critical} critical` : ''}`}
            >
              <div className="font-mono text-[12px] font-semibold text-dim">
                {z.zone}
                <div className="text-[12px] font-normal text-faint tnum">{z.items} item{z.items === 1 ? '' : 's'}</div>
              </div>

              <div className="relative flex h-6 items-center rounded-sm border border-edge/60 bg-panel2/60">
                <div className="absolute inset-y-0 left-1/2 w-px bg-edge2" aria-hidden="true" />
                {z.shortageValue > 0 && (
                  <div
                    className="absolute right-1/2 h-[14px] rounded-l-[4px] bg-bad/75"
                    style={{ width: `${shortPct / 2}%` }}
                  />
                )}
                {z.overageValue > 0 && (
                  <div
                    className="absolute left-1/2 h-[14px] rounded-r-[4px] bg-[#3987e5]"
                    style={{ width: `${overPct / 2}%` }}
                  />
                )}
              </div>

              <div className="tnum text-right font-mono text-[12px] font-semibold text-text">
                {fmtMoneyCompact(z.value)}
                {z.critical > 0 && <span className="ms-1 font-sans text-[12px] font-semibold text-bad" title={`${z.critical} critical`}>{z.critical} crit</span>}
              </div>
            </div>
          );
        })}
        {active.length === 0 && <p className="py-6 text-center text-[12px] text-faint">No unresolved variance in any zone.</p>}
      </div>
      <div className="mt-2 flex justify-between border-t border-edge/70 pt-2 text-[12px] text-faint">
        <span>Shrink (loss)</span>
        <span>Surplus (write-up)</span>
      </div>
      <ChartDataTable
        caption={`Data table (${active.length} zones)`}
        head={[
          { label: 'Zone' },
          { label: 'Items', align: 'right' },
          { label: 'Shrink', align: 'right' },
          { label: 'Surplus', align: 'right' },
          { label: 'Total', align: 'right' },
          { label: 'Crit', align: 'right' },
        ]}
        rows={active.map((z) => [
          `${z.zone} · ${z.name}`,
          String(z.items),
          fmtMoneyCompact(z.shortageValue),
          fmtMoneyCompact(z.overageValue),
          fmtMoneyCompact(z.value),
          String(z.critical),
        ])}
      />
    </ChartCard>
  );
}
