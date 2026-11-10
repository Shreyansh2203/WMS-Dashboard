import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { LayoutDashboard, TableProperties } from 'lucide-react';
import Sidebar, { type View } from './components/Sidebar';
import TopBar from './components/TopBar';
import DetailDrawer from './components/DetailDrawer';
import CommandPalette from './components/CommandPalette';
import ShortcutsHelp from './components/ShortcutsHelp';
import Toast from './components/Toast';
import Overview, { type RangeDays } from './views/Overview';
import Discrepancies from './views/Discrepancies';
import type { StreamState } from './components/StreamWatchdog';
import {
  SITES, genSeries, genDiscrepancies, genWorstCaseDiscrepancies, windowPair, summarizeWindow,
  type Discrepancy, type Status,
} from './data/mock';

// Dev-only worst-case fixture: open http://…/?worst=1 to render the stress data set
const WORST_CASE = typeof window !== 'undefined' && window.location.search.includes('worst=1');
import { exportDiscrepanciesCsv } from './lib/exportCsv';
import { loadResolutions, saveResolutions, type ResolutionEntry } from './lib/resolutionLog';

interface Override {
  status: Status;
  owner?: string | null;
  rootCause?: string | null;
  resolvedAt?: number;
}
type Overrides = Record<string, Override>;

const OVERRIDES_KEY = 'recon:overrides:v2';
const VIEW_PARAM = 'view';
const SITE_PARAM = 'site';
const readViewParam = (): View => {
  try {
    return new URLSearchParams(window.location.search).get(VIEW_PARAM) === 'discrepancies' ? 'discrepancies' : 'overview';
  } catch {
    return 'overview';
  }
};
const readSiteParam = (): string => {
  try {
    const id = new URLSearchParams(window.location.search).get(SITE_PARAM);
    return SITES.some((s) => s.id === id) ? (id as string) : SITES[0].id;
  } catch {
    return SITES[0].id;
  }
};
const loadOverrides = (): Overrides => {
  try {
    const raw = JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') as Record<string, Override | Status>;
    const out: Overrides = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') out[key] = { status: value };
      else if (value && typeof value === 'object' && typeof (value as Override).status === 'string') out[key] = value as Override;
    }
    return out;
  } catch {
    return {};
  }
};

function SkeletonView() {
  return (
    <div className="mx-auto max-w-[1520px] space-y-4 p-4 sm:p-6" role="status" aria-busy="true" aria-label="Loading warehouse data">
      <div className="shimmer h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer h-[116px]" />)}
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="shimmer col-span-12 h-[340px] xl:col-span-8" />
        <div className="shimmer col-span-12 h-[340px] md:col-span-6 xl:col-span-4" />
        <div className="shimmer col-span-12 h-[300px] md:col-span-6 xl:col-span-7" />
        <div className="shimmer col-span-12 h-[300px] xl:col-span-5" />
      </div>
      <span className="sr-only">Loading discrepancy data for the selected warehouse…</span>
    </div>
  );
}

export default function App() {
  const [siteId, setSiteId] = useState(readSiteParam);
  const [view, setView] = useState<View>(readViewParam);
  const [rangeDays, setRangeDays] = useState<RangeDays>(28);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [resolutions, setResolutions] = useState<ResolutionEntry[]>(loadResolutions);

  useEffect(() => {
    saveResolutions(resolutions);
  }, [resolutions]);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const [streamState, setStreamState] = useState<StreamState>('live');
  const searchRef = useRef<HTMLInputElement>(null);

  const site = useMemo(() => SITES.find((s) => s.id === siteId) ?? SITES[0], [siteId]);
  const series = useMemo(() => genSeries(site.seed), [site]);
  const rawRecords = useMemo(
    () => (WORST_CASE ? genWorstCaseDiscrepancies(site.seed) : genDiscrepancies(site.seed)),
    [site.seed],
  );

  useEffect(() => {
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)); } catch { /* storage unavailable */ }
  }, [overrides]);

  // deep-link view + warehouse (?view=discrepancies&site=atl-01)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === 'overview') url.searchParams.delete(VIEW_PARAM);
    else url.searchParams.set(VIEW_PARAM, view);
    if (siteId === SITES[0].id) url.searchParams.delete(SITE_PARAM);
    else url.searchParams.set(SITE_PARAM, siteId);
    window.history.replaceState(null, '', url);
  }, [view, siteId]);

  // client-side route change: move focus to <main> so SR users land on the new view
  const firstViewRender = useRef(true);
  useEffect(() => {
    if (firstViewRender.current) { firstViewRender.current = false; return; }
    document.getElementById('main-content')?.focus();
  }, [view]);

  // route-level document title (a11y: route changes announce via h1 + title)
  useEffect(() => {
    document.title = `Recon — ${view === 'overview' ? 'Overview' : 'Discrepancy queue'} · ${site.code}`;
  }, [view, site.code]);

  const applyOverride = useCallback((d: Discrepancy): Discrepancy => {
    const o = overrides[`${siteId}:${d.id}`];
    if (!o) return d;
    return {
      ...d,
      status: o.status,
      owner: o.owner !== undefined ? o.owner : d.owner ?? (o.status !== 'Open' ? 'J. Kowalski' : d.owner),
      rootCause: o.rootCause !== undefined ? o.rootCause : d.rootCause,
      resolvedAt: o.resolvedAt ?? d.resolvedAt,
    };
  }, [overrides, siteId]);

  const records = useMemo(() => rawRecords.map(applyOverride), [rawRecords, applyOverride]);

  const summary = useMemo(() => {
    const { current, prior } = windowPair(series, rangeDays);
    return summarizeWindow(current, prior);
  }, [series, rangeDays]);

  const siteUnresolved = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of SITES) {
      const recs = genDiscrepancies(s.seed);
      out[s.id] = recs.filter((d) => (overrides[`${s.id}:${d.id}`]?.status ?? d.status) !== 'Resolved').length;
    }
    return out;
  }, [overrides]);

  const unresolvedCount = useMemo(() => records.filter((d) => d.status !== 'Resolved').length, [records]);

  const criticalItems = useMemo(
    () => records
      .filter((d) => d.status !== 'Resolved' && d.severity === 'Critical')
      .sort((a, b) => Math.abs(b.valueVar) - Math.abs(a.valueVar)),
    [records],
  );

  const waveProgress = useMemo(() => {
    const last = series.slice(-14);
    const planned = last.reduce((a, d) => a + d.countsPlanned, 0);
    const done = last.reduce((a, d) => a + d.countsDone, 0);
    return planned > 0 ? (done / planned) * 100 : 0;
  }, [series]);

  const openRecord = openId ? records.find((d) => d.id === openId) ?? null : null;

  const setRecord = useCallback((id: string, patch: Partial<Override> & { status?: Status }, message: string) => {
    const key = `${siteId}:${id}`;
    const current = records.find((r) => r.id === id);
    setOverrides((prev) => {
      const before = prev[key];
      const next: Override = { ...before, ...patch, status: patch.status ?? before?.status ?? current?.status ?? 'Open' };
      setToast({
        message,
        onUndo: () =>
          setOverrides((cur) => {
            const restored = { ...cur };
            if (before === undefined) delete restored[key]; else restored[key] = before;
            return restored;
          }),
      });
      return { ...prev, [key]: next };
    });
  }, [siteId, records]);

  // shared multi-item patch: overrides + GL log + one toast/undo for the whole batch
  const bulkPatch = useCallback((ids: string[], patch: Partial<Override>, message: (n: number) => string, isResolution = false) => {
    setOverrides((prev) => {
      const beforeSnapshot: Record<string, Override | undefined> = {};
      const next = { ...prev };
      const now = Date.now();
      const entries: ResolutionEntry[] = [];
      for (const id of ids) {
        const key = `${siteId}:${id}`;
        beforeSnapshot[key] = prev[key];
        const current = records.find((r) => r.id === id);
        const before = prev[key];
        const status = patch.status ?? before?.status ?? current?.status ?? 'Open';
        next[key] = {
          ...before,
          ...patch,
          status,
          owner: patch.owner !== undefined ? patch.owner : before?.owner ?? current?.owner ?? (patch.status === 'Resolved' ? 'J. Kowalski' : null),
          rootCause: patch.rootCause !== undefined ? patch.rootCause : before?.rootCause ?? current?.rootCause,
          resolvedAt: patch.status === 'Resolved' ? now : before?.resolvedAt ?? current?.resolvedAt,
        };
        if (isResolution) {
          entries.push({
            key: `${key}:${now}`,
            siteId,
            id,
            item: current?.item ?? '—',
            location: current?.location ?? '—',
            valueVar: current?.valueVar ?? 0,
            rootCause: patch.rootCause ?? '—',
            resolvedAt: now,
            resolvedBy: 'J. Kowalski',
            reverted: false,
            before: { status: current?.status ?? 'Open', owner: current?.owner ?? null, rootCause: current?.rootCause ?? null },
          });
        }
      }
      if (entries.length > 0) setResolutions((log) => [...entries, ...log].slice(0, 50));
      setToast({
        message: message(ids.length),
        onUndo: () => {
          setOverrides((cur) => {
            const restored = { ...cur };
            for (const k of Object.keys(beforeSnapshot)) {
              if (beforeSnapshot[k] === undefined) delete restored[k];
              else restored[k] = beforeSnapshot[k];
            }
            return restored;
          });
          if (entries.length > 0) setResolutions((log) => log.map((e) => (entries.includes(e) ? { ...e, reverted: true } : e)));
        },
      });
      return next;
    });
  }, [siteId, records]);

  const revertResolution = useCallback((entry: ResolutionEntry) => {
    setOverrides((prev) => {
      const key = `${entry.siteId}:${entry.id}`;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], status: entry.before.status, owner: entry.before.owner, rootCause: entry.before.rootCause, resolvedAt: undefined },
      };
    });
    setResolutions((log) => log.map((e) => (e.key === entry.key ? { ...e, reverted: true } : e)));
    setToast({ message: `${entry.id} reverted to ${entry.before.status}` });
  }, []);

  const handleResolve = useCallback((id: string, rootCause: string) => {
    bulkPatch([id], { status: 'Resolved', rootCause }, () => `${id} marked resolved · ${rootCause} · variance adjustment posted to GL 5310`, true);
  }, [bulkPatch]);

  const handleAssignOwner = useCallback((id: string, owner: string | null) => {
    setRecord(id, { owner }, owner ? `${id} assigned to ${owner}` : `${id} cleared to Unassigned`);
  }, [setRecord]);

  const handleBulkAssign = useCallback((ids: string[], owner: string | null) => {
    bulkPatch(ids, { owner }, (n) => (owner ? `${n} ${n === 1 ? 'discrepancy' : 'discrepancies'} assigned to ${owner}` : `${n} ${n === 1 ? 'discrepancy' : 'discrepancies'} cleared to Unassigned`));
  }, [bulkPatch]);

  const handleBulkResolve = useCallback((ids: string[], rootCause: string) => {
    bulkPatch(ids, { status: 'Resolved', rootCause }, (n) => `${n} ${n === 1 ? 'discrepancy' : 'discrepancies'} resolved · ${rootCause} · variance adjustment posted to GL 5310`, true);
  }, [bulkPatch]);

  const handleBulkExport = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const rows = records.filter((d) => idSet.has(d.id));
    exportDiscrepanciesCsv(rows, siteId);
    setToast({ message: `Exported ${rows.length} selected rows → discrepancies-${siteId}.csv` });
  }, [records, siteId]);

  const handleStartInvestigation = useCallback((id: string) => {
    const current = records.find((r) => r.id === id);
    setRecord(id, { status: 'Investigating', owner: current?.owner ?? 'J. Kowalski' }, `${id} moved to Investigating · assigned to you`);
  }, [records, setRecord]);

  const handleOpenDiscrepancy = useCallback((id: string) => setOpenId(id), []);
  const handleOpenRecord = useCallback((d: Discrepancy) => setOpenId(d.id), []);
  const handleJumpToQueue = useCallback((q: string) => { setQuery(q); setView('discrepancies'); }, []);
  const handleViewAll = useCallback(() => setView('discrepancies'), []);

  const selectSite = useCallback((id: string) => {
    setSiteId((current) => {
      if (current === id) return current;
      setSwitching(true);
      setOpenId(null);
      window.setTimeout(() => setSwitching(false), 420);
      return id;
    });
  }, []);

  const handleExportQueue = useCallback(() => {
    exportDiscrepanciesCsv(records, siteId);
    setToast({ message: `Exported ${records.length} rows → discrepancies-${siteId}.csv` });
  }, [records, siteId]);

  // global keyboard map
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if (typing || paletteOpen || openId || shortcutsOpen) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === 'r' && !mod && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new Event('recon:force-refresh'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, openId, shortcutsOpen]);

  // keep drawer honest if a record disappears
  useEffect(() => { if (openId && !records.some((d) => d.id === openId)) setOpenId(null); }, [openId, records]);

  const overlayOpen = paletteOpen || openRecord !== null || shortcutsOpen;

  return (
    <div className="min-h-screen bg-ink font-sans text-text">
      <div inert={overlayOpen ? true : undefined}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar view={view} onNavigate={setView} unresolvedCount={unresolvedCount} waveProgress={waveProgress} />

      <div className="lg:ps-60">
        <TopBar
          site={site}
          onSiteChange={selectSite}
          siteUnresolved={siteUnresolved}
          rowsApplied={rawRecords.length}
          query={query}
          onQueryChange={setQuery}
          onSearchSubmit={() => setView('discrepancies')}
          onOpenPalette={() => setPaletteOpen(true)}
          onToast={(msg) => setToast({ message: msg })}
          criticalItems={criticalItems}
          onOpenDiscrepancy={handleOpenDiscrepancy}
          onViewAll={() => setView('discrepancies')}
          searchRef={searchRef}
          onStreamStateChange={setStreamState}
        />

        {/* Freshness banner — never a modal, per stream-health-ux */}
        {(streamState === 'stale' || streamState === 'offline') && (
          <div
            role="alert"
            className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-center text-[12px] font-medium ${
              streamState === 'offline'
                ? 'border-bad/30 bg-bad/[0.12] text-bad'
                : 'border-amber/30 bg-amber/[0.08] text-amber'
            }`}
          >
            <span>
              {streamState === 'offline'
                ? 'Connection lost. Last confirmed numbers shown. Retrying with backoff.'
                : 'Feed past SLA. Numbers may be out of date.'}
            </span>
            <button
              onClick={() => window.dispatchEvent(new Event('recon:force-refresh'))}
              className="font-semibold underline underline-offset-2 hover:text-text"
            >
              Force refresh
            </button>
          </div>
        )}

        {/* Mobile view switcher (sidebar hidden below lg) */}
        <nav className="flex gap-1 border-b border-edge bg-rail px-4 py-2 lg:hidden" aria-label="Views">
          {([
            { id: 'overview' as View, label: 'Overview', icon: LayoutDashboard },
            { id: 'discrepancies' as View, label: `Discrepancies (${unresolvedCount})`, icon: TableProperties },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors sm:gap-2 sm:px-3 sm:text-[12px] ${
                view === id ? 'bg-panel3 text-amber' : 'text-dim hover:text-text'
              }`}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        <main id="main-content" tabIndex={-1} className="outline-none">
          {switching ? (
            <SkeletonView />
          ) : view === 'overview' ? (
            <Overview
              site={site}
              series={series}
              summary={summary}
              records={records}
              rangeDays={rangeDays}
              onRangeChange={setRangeDays}
              query={deferredQuery}
              onQueryChange={setQuery}
              onOpen={handleOpenRecord}
              onViewAll={handleViewAll}
              onJumpToQueue={handleJumpToQueue}
              activeId={openId}
            />
          ) : (
            <Discrepancies
              site={site}
              records={records}
              query={deferredQuery}
              onQueryChange={setQuery}
              onOpen={handleOpenRecord}
              activeId={openId}
              onBulkAssign={handleBulkAssign}
              onBulkResolve={handleBulkResolve}
              onBulkExport={handleBulkExport}
              resolutionLog={resolutions}
              onRevertResolution={revertResolution}
            />
          )}
        </main>
      </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        records={records}
        siteId={siteId}
        onSiteChange={selectSite}
        onJump={setView}
        onOpenDiscrepancy={handleOpenDiscrepancy}
        rangeDays={rangeDays}
        onRangeChange={setRangeDays}
        onExportQueue={handleExportQueue}
      />

      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {openRecord && (
        <DetailDrawer
          record={openRecord}
          onClose={() => setOpenId(null)}
          onResolve={handleResolve}
          onStartInvestigation={handleStartInvestigation}
          onAssignOwner={handleAssignOwner}
        />
      )}
      {toast && <Toast message={toast.message} onUndo={toast.onUndo} onDismiss={() => setToast(null)} />}
    </div>
  );
}
