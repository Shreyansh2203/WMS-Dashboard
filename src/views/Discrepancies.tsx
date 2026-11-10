import { useMemo } from 'react';
import { X, Search, ClipboardCheck } from 'lucide-react';
import DiscrepancyTable from '../components/DiscrepancyTable';
import ChartCard from '../components/ChartCard';
import type { Discrepancy, Site } from '../data/mock';
import type { ResolutionEntry } from '../lib/resolutionLog';
import { fmtInt, fmtDateFull, timeAgo } from '../lib/format';

interface DiscrepanciesProps {
  site: Site;
  records: Discrepancy[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (d: Discrepancy) => void;
  activeId: string | null;
  onBulkAssign: (ids: string[], owner: string | null) => void;
  onBulkResolve: (ids: string[], rootCause: string) => void;
  onBulkExport: (ids: string[]) => void;
  resolutionLog: ResolutionEntry[];
  onRevertResolution: (entry: ResolutionEntry) => void;
}

export default function Discrepancies({
  site, records, query, onQueryChange, onOpen, activeId,
  onBulkAssign, onBulkResolve, onBulkExport, resolutionLog, onRevertResolution,
}: DiscrepanciesProps) {
  const stats = useMemo(() => {
    const open = records.filter((d) => d.status === 'Open').length;
    const investigating = records.filter((d) => d.status === 'Investigating').length;
    const resolved = records.filter((d) => d.status === 'Resolved').length;
    const valueAtRisk = records
      .filter((d) => d.status !== 'Resolved')
      .reduce((a, d) => a + Math.abs(d.valueVar), 0);
    return { open, investigating, resolved, valueAtRisk };
  }, [records]);

  const chips = [
    { label: 'Open', value: fmtInt(stats.open), dot: '#F2B33D' },
    { label: 'Investigating', value: fmtInt(stats.investigating), dot: '#6FA8FF' },
    { label: 'Resolved · 28d', value: fmtInt(stats.resolved), dot: '#41D99A' },
    { label: 'Value at risk', value: `$${fmtInt(stats.valueAtRisk)}`, dot: '#F26D5B' },
  ];

  const logForSite = useMemo(
    () => resolutionLog.filter((e) => e.siteId === site.id).slice(0, 8),
    [resolutionLog, site.id],
  );

  return (
    <div className="mx-auto max-w-[1520px] space-y-4 p-4 sm:p-6">
      {/* Heading */}
      <div className="rise rise-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="balance text-[19px] font-semibold leading-tight tracking-[-0.01em] text-text">Discrepancy queue</h1>
          <p className="pretty mt-1 text-[11px] text-faint">
            Every variance from wave CC-2026-W45 at <span className="font-mono text-dim">{site.code}</span> · select rows to assign or post a GL adjustment in bulk
          </p>
        </div>
        {query.trim() && (
          <button onClick={() => onQueryChange('')}
            className="flex h-8 items-center gap-2 rounded-lg border border-amber/30 bg-amber/[0.08] ps-2.5 pe-2 text-[11px] font-semibold text-amber transition-colors hover:bg-amber/15">
            <Search size={12} aria-hidden="true" /> Filtered: “{query.trim()}” <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Status summary */}
      <div className="rise rise-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {chips.map(({ label, value, dot }) => (
          <div key={label} className="panel flex items-center gap-3 px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-faint">{label}</div>
              <div className="tnum mt-0.5 font-mono text-[17px] font-medium leading-none text-text">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Full grid */}
      <div className="rise rise-3">
        <ChartCard title="All discrepancies" subtitle="Filter → select → assign or resolve in bulk · click a column header to sort · ↑ ↓ to move between rows" bodyClassName="p-0">
          <DiscrepancyTable
            records={records}
            density="full"
            query={query}
            onQueryChange={onQueryChange}
            onOpen={onOpen}
            siteId={site.id}
            activeId={activeId}
            enableBulk
            onBulkAssign={onBulkAssign}
            onBulkResolve={onBulkResolve}
            onBulkExport={onBulkExport}
          />
        </ChartCard>
      </div>

      {/* Resolution log — persisted locally, revert-aware */}
      {logForSite.length > 0 && (
        <section className="rise rise-4 overflow-hidden rounded-xl border border-edge bg-panel" aria-labelledby="resolution-log-title">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-5 py-2.5">
            <div className="min-w-0">
              <h2 id="resolution-log-title" className="flex items-center gap-2 text-[12px] font-semibold text-text">
                <ClipboardCheck size={13} className="text-good" aria-hidden="true" /> Resolution log
              </h2>
              <p className="mt-0.5 text-[11px] text-faint">Adjustment trail for {site.code} · kept on this device</p>
            </div>
            <span className="tnum font-mono text-[11px] text-faint">{logForSite.length} entr{logForSite.length === 1 ? 'y' : 'ies'}</span>
          </header>
          <ol className="divide-y divide-edge/60">
            {logForSite.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[12px]">
                <span className="tnum flex w-[142px] shrink-0 font-mono text-[11px] text-faint" title={fmtDateFull(entry.resolvedAt)}>
                  {timeAgo(entry.resolvedAt)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-amber">{entry.id}</span>
                <span className="min-w-0 flex-1 basis-40 truncate text-dim" title={entry.item}>{entry.item}</span>
                <span className="tnum font-mono text-[11px] text-dim">{entry.valueVar >= 0 ? '+' : '−'}${Math.abs(entry.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })} · {entry.rootCause}</span>
                <span className="hidden text-[11px] text-faint lg:inline">by {entry.resolvedBy}</span>
                {entry.reverted ? (
                  <span className="text-[11px] font-medium text-faint">reverted</span>
                ) : (
                  <button onClick={() => onRevertResolution(entry)} className="rounded-md border border-edge px-2 py-1 text-[11px] font-semibold text-amber transition-colors hover:border-edge2 hover:text-text">
                    Revert
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
