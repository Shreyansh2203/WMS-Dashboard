import { memo, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight,
  Download, PackageSearch, ArrowRight, Eye,
} from 'lucide-react';
import {
  SEV_RANK, STATUS_RANK, TYPE_ORDER, ZONES, ROOT_CAUSES, ASSIGNABLE,
  type Discrepancy, type DiscrepancyType, type Severity, type Status,
} from '../data/mock';
import { fmtInt, timeAgo } from '../lib/format';
import { exportDiscrepanciesCsv } from '../lib/exportCsv';
import { useMediaQuery } from '../lib/useMediaQuery';

export type Density = 'compact' | 'full';
type SortKey = 'detectedAt' | 'id' | 'item' | 'location' | 'type' | 'varQty' | 'valueVar' | 'severity' | 'status';

interface DiscrepancyTableProps {
  records: Discrepancy[];
  density: Density;
  query: string;
  onQueryChange?: (q: string) => void;
  onOpen: (d: Discrepancy) => void;
  onViewAll?: () => void;
  siteId: string;
  activeId?: string | null;
  /** Row selection + bulk actions (full queue only). */
  enableBulk?: boolean;
  onBulkAssign?: (ids: string[], owner: string | null) => void;
  onBulkResolve?: (ids: string[], rootCause: string) => void;
  onBulkExport?: (ids: string[]) => void;
}

const sevPill: Record<Severity, string> = {
  Critical: 'pill pill-critical', High: 'pill pill-high', Medium: 'pill pill-medium', Low: 'pill pill-low',
};
const statusPill: Record<Status, string> = {
  Open: 'pill pill-open', Investigating: 'pill pill-invest', Resolved: 'pill pill-resolved',
};

const selectCls =
  'h-8 appearance-none rounded-lg border border-edge bg-panel2 ps-2.5 pe-7 text-[12px] font-medium text-dim transition-colors hover:border-edge2 hover:text-text focus:border-amber/50';

const chipCls = (on: boolean) =>
  `h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${on ? 'border-amber/50 bg-amber/[0.08] text-amber' : 'border-edge bg-panel2 text-dim hover:border-edge2 hover:text-text'}`;

const columns: { label: string; k: SortKey; align?: 'left' | 'right' | 'center'; className?: string }[] = [
  { label: 'Ref', k: 'id', className: 'col-pinned min-w-[76px]' },
  { label: 'Item', k: 'item' },
  { label: 'Value', k: 'valueVar', align: 'right' },
  { label: 'Var qty', k: 'varQty', align: 'right' },
  { label: 'Sev', k: 'severity', align: 'center' },
  { label: 'Status', k: 'status', align: 'center' },
  { label: 'Age', k: 'detectedAt', className: 'pe-3' },
  { label: 'Location', k: 'location' },
  { label: 'Type', k: 'type' },
];

export default memo(function DiscrepancyTable({ records, density, query, onQueryChange, onOpen, onViewAll, siteId, activeId, enableBulk = false, onBulkAssign, onBulkResolve, onBulkExport }: DiscrepancyTableProps) {
  const full = density === 'full';
  const [typeFilter, setTypeFilter] = useState<'' | DiscrepancyType>('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [sevFilter, setSevFilter] = useState<'' | Severity>('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkRootCause, setBulkRootCause] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('valueVar');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [query, typeFilter, zoneFilter, sevFilter, statusFilter, unassignedOnly, staleOnly, records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = records.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (zoneFilter && d.zone !== zoneFilter) return false;
      if (sevFilter && d.severity !== sevFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      if (unassignedOnly && d.owner) return false;
      if (staleOnly && Date.now() - d.detectedAt <= 48 * 3_600_000) return false;
      if (!q) return true;
      const hay = `${d.id} ${d.sku} ${d.item} ${d.category} ${d.location} ${d.zone} ${d.zoneName} ${d.type} ${d.severity} ${d.status} ${d.owner ?? 'unassigned'} ${d.abc}`.toLowerCase();
      return hay.includes(q);
    });
    const dir = sortDir;
    const val = (d: Discrepancy): number | string => {
      switch (sortKey) {
        case 'detectedAt': return d.detectedAt;
        case 'id': return d.id;
        case 'item': return d.item.toLowerCase();
        case 'location': return d.location;
        case 'type': return d.type;
        case 'varQty': return d.varQty;
        case 'valueVar': return Math.abs(d.valueVar);
        case 'severity': return SEV_RANK[d.severity];
        case 'status': return STATUS_RANK[d.status];
      }
    };
    rows = [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
      return cmp * dir;
    });
    return rows;
  }, [records, query, typeFilter, zoneFilter, sevFilter, statusFilter, unassignedOnly, staleOnly, sortKey, sortDir]);

  const pageSize = full ? 12 : 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const pageIds = pageRows.map((d) => d.id);
  const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const isNarrow = useMediaQuery('(max-width: 639px)');
  const hasActiveFilters = Boolean(typeFilter || zoneFilter || sevFilter || statusFilter || unassignedOnly || staleOnly || query.trim());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const togglePageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearFilters = () => {
    setTypeFilter(''); setZoneFilter(''); setSevFilter(''); setStatusFilter('');
    setUnassignedOnly(false); setStaleOnly(false);
    onQueryChange?.('');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(key === 'item' || key === 'location' || key === 'id' || key === 'type' ? 1 : -1); }
  };

  // keyboard navigation between row buttons (the single tab stop per row)
  const onTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA|OPTION)$/.test(target.tagName)) return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl?.hasAttribute('data-ref-btn')) return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-ref-btn]'));
    if (buttons.length === 0) return;
    const idx = buttons.indexOf(activeEl as HTMLButtonElement);
    e.preventDefault();
    if (e.key === 'Home') buttons[0].focus();
    else if (e.key === 'End') buttons[buttons.length - 1].focus();
    else if (e.key === 'ArrowDown') buttons[Math.min(buttons.length - 1, (idx < 0 ? 0 : idx) + 1)].focus();
    else buttons[Math.max(0, (idx < 0 ? 0 : idx) - 1)].focus();
  };

  return (
    <div onKeyDown={onTableKeyDown}>
      {/* Toolbar (full density only) */}
      {full && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <label className="sr-only" htmlFor="f-type">Type</label>
          <div className="relative">
            <select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls}>
              <option value="">All types</option>
              {TYPE_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          </div>
          <div className="relative">
            <label className="sr-only" htmlFor="f-zone">Zone</label>
            <select id="f-zone" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={selectCls}>
              <option value="">All zones</option>
              {ZONES.map((z) => <option key={z.id} value={z.id}>{z.id} · {z.name}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          </div>
          <div className="relative">
            <label className="sr-only" htmlFor="f-sev">Severity</label>
            <select id="f-sev" value={sevFilter} onChange={(e) => setSevFilter(e.target.value as typeof sevFilter)} className={selectCls}>
              <option value="">All severities</option>
              {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          </div>
          <div className="relative">
            <label className="sr-only" htmlFor="f-status">Status</label>
            <select id="f-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
              <option value="">All statuses</option>
              {(['Open', 'Investigating', 'Resolved'] as Status[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          </div>
          <button type="button" onClick={() => setUnassignedOnly((v) => !v)} aria-pressed={unassignedOnly} className={chipCls(unassignedOnly)}>Unassigned</button>
          <button type="button" onClick={() => setStaleOnly((v) => !v)} aria-pressed={staleOnly} className={chipCls(staleOnly)}>Age &gt; 48h</button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="h-9 sm:h-8 rounded-lg px-2 text-[12px] font-semibold text-faint underline-offset-2 transition-colors hover:text-text hover:underline">
              Clear all
            </button>
          )}
          <div className="ms-auto flex items-center gap-2">
            <span aria-live="polite" className="tnum font-mono text-[12px] text-faint">{fmtInt(filtered.length)} result{filtered.length === 1 ? '' : 's'}</span>
            <button onClick={() => exportDiscrepanciesCsv(filtered, siteId)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-edge bg-panel2 px-2.5 text-[12px] font-semibold text-dim transition-colors hover:border-edge2 hover:text-text">
              <Download size={13} aria-hidden="true" /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {enableBulk && selectedIds.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-b border-edge bg-panel2/60 px-4 py-2">
          <span className="tnum font-mono text-[12px] font-semibold text-amber">{selectedIds.size} selected</span>
          <label className="sr-only" htmlFor="bulk-assign">Assign selected to owner</label>
          <select
            id="bulk-assign"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              onBulkAssign?.([...selectedIds], e.target.value === '__unassign__' ? null : e.target.value);
              setSelectedIds(new Set());
            }}
            className={selectCls}
          >
            <option value="">Assign to…</option>
            {ASSIGNABLE.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__unassign__">Unassign</option>
          </select>
          {bulkResolving ? (
            <>
              <label className="sr-only" htmlFor="bulk-root-cause">Root cause for the selected items</label>
              <select
                id="bulk-root-cause"
                value={bulkRootCause}
                onChange={(e) => setBulkRootCause(e.target.value)}
                autoFocus
                className={selectCls}
              >
                <option value="">Root cause…</option>
                {ROOT_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="button"
                disabled={!bulkRootCause}
                onClick={() => {
                  if (!bulkRootCause) return;
                  onBulkResolve?.([...selectedIds], bulkRootCause);
                  setSelectedIds(new Set());
                  setBulkResolving(false);
                  setBulkRootCause('');
                }}
                className="h-9 sm:h-8 rounded-lg bg-amber px-2.5 text-[12px] font-semibold text-[#1B1408] transition-colors hover:bg-amber-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                Post adjustment ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => { setBulkResolving(false); setBulkRootCause(''); }}
                className="h-9 sm:h-8 rounded-lg px-2 text-[12px] font-semibold text-faint transition-colors hover:text-text"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setBulkResolving(true)}
                className="h-9 sm:h-8 rounded-lg border border-amber/40 bg-amber/[0.08] px-2.5 text-[12px] font-semibold text-amber transition-colors hover:bg-amber/[0.14]"
              >
                Resolve…
              </button>
              <button
                type="button"
                onClick={() => onBulkExport?.([...selectedIds])}
                className="h-9 sm:h-8 rounded-lg border border-edge px-2.5 text-[12px] font-semibold text-dim transition-colors hover:border-edge2 hover:text-text"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="h-9 sm:h-8 rounded-lg px-2 text-[12px] font-semibold text-faint transition-colors hover:text-text"
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {/* Phone card list (below sm) or sticky grid */}
      {full && isNarrow ? (
        <ul className="flex flex-col gap-2 bg-panel2/40 p-2">
          {pageRows.map((d) => (
            <li key={d.id} className="rounded-xl border border-edge bg-panel2">
              <div className="flex items-start gap-2 p-3">
                {enableBulk && (
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-panel3">
                    <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} aria-label={`Select ${d.id}`} className="h-5 w-5 accent-[#F2B33D]" />
                  </label>
                )}
                <button onClick={() => onOpen(d)} aria-label={`Open discrepancy ${d.id}`} className="min-w-0 flex-1 text-start">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-amber">{d.id}</span>
                    <span className={sevPill[d.severity]}><span className="dot" />{d.severity}</span>
                    <span className={statusPill[d.status]}><span className="dot" />{d.status}</span>
                    <span className="ms-auto tnum font-mono text-[11px] text-faint">{timeAgo(d.detectedAt)}</span>
                  </span>
                  <span className="mt-1.5 block truncate text-[13px] font-semibold text-text" title={d.item}>{d.item}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">{d.sku} · {d.abc}-class · {d.location}</span>
                  <span className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className={`tnum font-mono text-[15px] font-semibold ${d.valueVar === 0 ? 'text-faint' : d.valueVar < 0 ? 'text-bad' : 'text-text'}`}>
                      {d.valueVar === 0 ? '—' : `${d.valueVar < 0 ? '−' : '+'}$${Math.abs(d.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    </span>
                    <span className={`tnum font-mono text-[12px] font-medium ${d.varQty === 0 ? 'text-faint' : d.varQty < 0 ? 'text-bad' : 'text-text'}`}>
                      {d.varQty === 0 ? 'match' : `${d.varQty > 0 ? '+' : ''}${d.varQty.toLocaleString()} units`}
                    </span>
                  </span>
                </button>
              </div>
            </li>
          ))}
          {pageRows.length === 0 && (
            <li className="rounded-xl border border-edge p-6 text-center text-[12px] text-faint">
              <span className="block">No matching discrepancies</span>
              <button onClick={clearFilters} className="mt-2 rounded-lg border border-edge2 bg-panel2 px-3 py-2 text-[12px] font-semibold text-dim transition-colors hover:text-text">Clear filters</button>
            </li>
          )}
        </ul>
      ) : (
      <div className={`relative overflow-auto overscroll-contain shadow-[inset_-14px_0_12px_-12px_rgba(0,0,0,0.55)] sm:shadow-none ${full ? 'max-h-[640px]' : ''}`}>
        <table aria-label="Discrepancies" className="thead-sticky w-full min-w-[880px] border-collapse text-start">
          <thead>
            <tr className="border-b border-edge">
              {columns.map(({ label, k, align, className = '' }) => {
                const active = sortKey === k;
                const Icon = sortDir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={k}
                    scope="col"
                    aria-sort={active ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={`px-3 py-2 font-mono text-[12px] font-medium text-faint whitespace-nowrap ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''} ${className} ${k === 'id' ? 'ps-4' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {enableBulk && k === 'id' ? (
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                        onChange={togglePageSelection}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select all rows on this page"
                        className="h-4 w-4 shrink-0 accent-[#F2B33D]"
                      />
                    ) : null}
                    <button
                      onClick={() => toggleSort(k)}
                      aria-label={`Sort by ${label}${active ? (sortDir === 1 ? ', ascending' : ', descending') : ''}`}
                      className={`inline-flex items-center gap-1 rounded px-1 py-1.5 transition-colors hover:text-text ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-amber' : ''}`}
                    >
                      {label}
                      <span className="inline-flex w-3 justify-center" aria-hidden="true">
                        {active ? <Icon size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
                      </span>
                    </button>
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="col-pinned-right w-[76px] px-3 py-2 text-center font-mono text-[12px] font-medium text-faint"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((d) => {
              const selected = activeId === d.id;
              return (
                <tr
                  key={d.id}
                  onClick={() => onOpen(d)}
                  className={`row-hover group cursor-pointer border-b border-edge/50 outline-none ${selected ? 'row-selected bg-amber/[0.05]' : ''}`}
                >
                  <td className="col-pinned px-3 py-2 ps-4">
                    <div className="flex items-center gap-2">
                    {enableBulk && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${d.id}`}
                        className="h-4 w-4 shrink-0 accent-[#F2B33D]"
                      />
                    )}
                    <button
                      data-ref-btn
                      data-ref-id={d.id}
                      onClick={(e) => { e.stopPropagation(); onOpen(d); }}
                      aria-label={`Open discrepancy ${d.id}`}
                      className={`inline-flex items-center whitespace-nowrap rounded py-1 font-mono text-[12px] font-semibold underline-offset-2 transition-colors hover:underline ${selected ? 'text-amber' : 'text-info hover:text-text'}`}
                    >
                      {d.id}
                    </button>
                    </div>
                  </td>
                  <td className="max-w-[280px] px-3 py-2">
                    <div className="truncate text-[12px] font-medium text-text" title={d.item}>{d.item}</div>
                    <div className="font-mono text-[12px] text-faint">{d.sku} · {d.abc}-class</div>
                  </td>
                  <td className={`tnum whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] font-medium ${d.valueVar === 0 ? 'text-faint' : d.valueVar < 0 ? 'text-bad' : 'text-text'}`}>
                    {d.valueVar === 0 ? '—' : `${d.valueVar < 0 ? '−' : '+'}$${Math.abs(d.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  </td>
                  <td className={`tnum whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] font-medium ${d.varQty === 0 ? 'text-faint' : d.varQty < 0 ? 'text-bad' : 'text-text'}`}>
                    {d.varQty === 0 ? '—' : `${d.varQty > 0 ? '+' : ''}${d.varQty.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-2 text-center"><span className={sevPill[d.severity]}><span className="dot" />{d.severity}</span></td>
                  <td className="px-3 py-2 text-center"><span className={statusPill[d.status]}><span className="dot" />{d.status}</span></td>
                  <td className="tnum whitespace-nowrap px-3 py-2 font-mono text-[12px] text-faint">{timeAgo(d.detectedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-dim">{d.location}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[12px] text-dim">{d.type}</td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className={`flex items-center justify-end ${full ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'}`}>
                      <button onClick={() => onOpen(d)} aria-label={`Open ${d.id}`} title={`Open ${d.id}`}
                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-panel3 hover:text-text">
                        <Eye size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center">
                  <PackageSearch size={26} className="mx-auto text-faint" strokeWidth={1.5} aria-hidden="true" />
                  <p className="mt-3 text-[13px] font-semibold text-text">No discrepancies match{hasActiveFilters ? ' these filters' : ''}</p>
                  <p className="pretty mt-1 text-[12px] text-faint">Widen the search, or clear filters to see the full queue.</p>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="mt-3 rounded-lg border border-edge2 bg-panel2 px-3 py-1.5 text-[12px] font-semibold text-dim transition-colors hover:text-text">
                      Clear all filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-edge px-4 py-2.5">
        <span className="tnum font-mono text-[12px] text-faint">
          {filtered.length === 0 ? '0 results' : `Showing ${safePage * pageSize + 1}–${Math.min(filtered.length, (safePage + 1) * pageSize)} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-1.5">
          {!full && onViewAll && (
            <button onClick={onViewAll} className="me-2 hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12px] font-semibold text-amber transition-colors hover:bg-amber/10 sm:flex">
              Open discrepancy queue <ArrowRight size={13} className="flip-rtl" aria-hidden="true" />
            </button>
          )}
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page"
            className="rounded-lg border border-edge p-1.5 text-dim transition-colors hover:border-edge2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30">
            <ChevronLeft size={15} className="flip-rtl" aria-hidden="true" />
          </button>
          <span className="tnum px-1 font-mono text-[12px] text-dim">Page {safePage + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page"
            className="rounded-lg border border-edge p-1.5 text-dim transition-colors hover:border-edge2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30">
            <ChevronRight size={15} className="flip-rtl" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});
