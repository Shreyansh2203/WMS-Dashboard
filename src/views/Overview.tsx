import { useMemo } from 'react';
import KpiStrip from '../components/KpiStrip';
import AccuracyTrend from '../components/AccuracyTrend';
import TypeMix from '../components/TypeMix';
import ZoneVariance from '../components/ZoneVariance';
import Insights from '../components/Insights';
import ChartCard from '../components/ChartCard';
import DiscrepancyTable from '../components/DiscrepancyTable';
import { type DayPoint, type Discrepancy, type Site, type WindowSummary, zoneStats, typeStats, buildInsights } from '../data/mock';

export type RangeDays = 7 | 28 | 90;

interface OverviewProps {
  site: Site;
  series: DayPoint[];
  summary: WindowSummary;
  records: Discrepancy[];
  rangeDays: RangeDays;
  onRangeChange: (d: RangeDays) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (d: Discrepancy) => void;
  onViewAll: () => void;
  onJumpToQueue: (query: string) => void;
  activeId: string | null;
}

export default function Overview({
  site, series, summary, records, rangeDays, onRangeChange, query, onQueryChange, onOpen, onViewAll, onJumpToQueue, activeId,
}: OverviewProps) {
  const derived = useMemo(() => {
    const unresolved = records.filter((d) => d.status !== 'Resolved');
    const open = unresolved.filter((d) => d.status === 'Open');
    // window = detected in the selected range; the overview's aggregate analytics are window-scoped,
    // the "Unresolved · now" KPI stays the live snapshot (labeled as such)
    const inWindow = unresolved.filter((d) => Date.now() - d.detectedAt <= rangeDays * 86_400_000);
    return {
      unresolved,
      windowRecords: inWindow,
      open,
      investigatingCount: unresolved.filter((d) => d.status === 'Investigating').length,
      criticalCount: unresolved.filter((d) => d.severity === 'Critical').length,
      criticalCountWindow: inWindow.filter((d) => d.severity === 'Critical').length,
      unassignedCount: open.filter((d) => !d.owner).length,
      zones: zoneStats(inWindow),
      types: typeStats(inWindow),
      insights: buildInsights(unresolved, summary, rangeDays),
    };
  }, [records, summary, rangeDays]);

  return (
    <div className="mx-auto max-w-[1520px] space-y-4 p-4 sm:p-6">
      {/* Heading + window control */}
      <div className="rise rise-1 flex flex-wrap items-end justify-between gap-3">        <div>
          <h1 className="balance text-[19px] font-semibold leading-tight tracking-[-0.01em] text-text">Reconciliation overview</h1>
          <p className="pretty mt-1 text-[12px] text-faint">
            Blind cycle counts at <span className="font-mono text-dim">{site.code}</span> · wave CC-2026-W45
          </p>
        </div>
        <div className="seg" role="group" aria-label="Analysis window">
          {([7, 28, 90] as RangeDays[]).map((d) => (
            <button key={d} aria-pressed={rangeDays === d} onClick={() => onRangeChange(d)}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="rise rise-2">
        <KpiStrip
          summary={summary}
          rangeDays={rangeDays}
          openCount={derived.open.length}
          investigatingCount={derived.investigatingCount}
          criticalCount={derived.criticalCount}
          unassignedCount={derived.unassignedCount}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="rise rise-3 col-span-12 xl:col-span-8"><AccuracyTrend series={series} rangeDays={rangeDays} /></div>
        <div className="rise rise-3 col-span-12 md:col-span-6 xl:col-span-4"><TypeMix stats={derived.types} rangeDays={rangeDays} /></div>
        <div className="rise rise-4 col-span-12 md:col-span-6 xl:col-span-7"><ZoneVariance stats={derived.zones} rangeDays={rangeDays} /></div>
        <div className="rise rise-4 col-span-12 xl:col-span-5"><Insights insights={derived.insights} onAction={onJumpToQueue} /></div>
      </div>

      <div className="rise rise-5">
        <ChartCard
          title="Highest-value unresolved discrepancies"
          subtitle="Sorted by $ at risk"
          bodyClassName="p-0"
        >
          <DiscrepancyTable
            records={derived.windowRecords}
            density="compact"
            query={query}
            onQueryChange={onQueryChange}
            onOpen={onOpen}
            onViewAll={onViewAll}
            siteId={site.id}
            activeId={activeId}
          />
        </ChartCard>
      </div>
    </div>
  );
}
