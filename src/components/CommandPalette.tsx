import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Search, LayoutDashboard, TableProperties, ScanBarcode, Download, RefreshCw,
  ChevronRight, Warehouse, Check, CornerDownLeft, TriangleAlert,
} from 'lucide-react';
import { SITES, type Discrepancy } from '../data/mock';
import type { RangeDays } from '../views/Overview';
import { modKeyLabel } from '../lib/platform';
import { useFocusTrap } from '../lib/useFocusTrap';

export type View = 'overview' | 'discrepancies';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  records: Discrepancy[];
  siteId: string;
  onSiteChange: (id: string) => void;
  onJump: (view: View) => void;
  onOpenDiscrepancy: (id: string) => void;
  rangeDays: RangeDays;
  onRangeChange: (d: RangeDays) => void;
  onExportQueue: () => void;
}

interface Item {
  id: string;
  group: string;
  icon: typeof LayoutDashboard;
  label: string;
  keywords: string;
  hint?: ReactNode;
  run: () => void;
}

const RECENTS_KEY = 'recon:recents';
const RECENTS_MAX = 5;
function readRecents(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENTS_MAX) : []; }
  catch { return []; }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

/** Subsequence fuzzy match. Returns match indices into `target`, or null. */
function fuzzyIndices(query: string, target: string): number[] | null {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const t = target.toLowerCase();
  const idxs: number[] = [];
  let ti = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    idxs.push(found);
    ti = found + 1;
  }
  return idxs;
}

function scoreOf(idxs: number[] | null): number {
  if (!idxs) return -1;
  if (idxs.length === 0) return 1;
  let score = 0;
  for (let i = 0; i < idxs.length; i++) {
    score += 1;
    if (i > 0 && idxs[i] === idxs[i - 1] + 1) score += 2; // consecutive bonus
  }
  if (idxs[0] === 0) score += 2; // anchored at start
  return score;
}

function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>;
  const set = new Set(indices);
  const out: ReactNode[] = [];
  let buf = '';
  let key = 0;
  for (let i = 0; i < text.length; i++) {
    if (set.has(i)) {
      if (buf) { out.push(buf); buf = ''; }
      out.push(<mark key={key++} className="rounded-[3px] bg-amber/25 text-amber">{text[i]}</mark>);
    } else buf += text[i];
  }
  if (buf) out.push(buf);
  return <>{out}</>;
}

export default function CommandPalette({
  open, onClose, records, siteId, onSiteChange, onJump, onOpenDiscrepancy,
  rangeDays, onRangeChange, onExportQueue,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>(() => readRecents());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const paletteTrapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setQuery('');
      setActive(0);
      setRecents(readRecents());
      // focus after mount
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => {
        window.cancelAnimationFrame(id);
        (triggerRef.current as HTMLElement | null)?.focus?.();
      };
    }
  }, [open]);

  const firstCritical = useMemo(
    () => [...records].filter((d) => d.status !== 'Resolved' && d.severity === 'Critical').sort((a, b) => Math.abs(b.valueVar) - Math.abs(a.valueVar))[0],
    [records],
  );

  const openDiscrepancy = (id: string) => {
    pushRecent(id);
    setRecents(readRecents());
    onOpenDiscrepancy(id);
    onClose();
  };

  const allItems = useMemo<Item[]>(() => {
    const items: Item[] = [];

    // Recent discrepancy refs (empty query only)
    const byId = new Map(records.map((d) => [d.id, d]));
    for (const id of recents) {
      const d = byId.get(id);
      if (!d) continue;
      items.push({
        id: `recent:${d.id}`,
        group: 'Recent',
        icon: TableProperties,
        label: `${d.id} — ${d.item}`,
        keywords: `${d.id} ${d.sku} ${d.item} ${d.location} ${d.owner ?? ''}`,
        hint: <span className="text-faint">{d.zoneName}</span>,
        run: () => openDiscrepancy(d.id),
      });
    }

    // Discrepancy matches
    for (const d of records) {
      items.push({
        id: `disc:${d.id}`,
        group: 'Discrepancy',
        icon: TableProperties,
        label: `${d.id} — ${d.item}`,
        keywords: `${d.id} ${d.sku} ${d.item} ${d.location} ${d.zoneName} ${d.owner ?? ''}`,
        hint: <span className="font-mono text-[12px] text-faint">{d.location} · {Math.abs(d.valueVar) >= 1000 ? `$${(Math.abs(d.valueVar) / 1000).toFixed(1)}K` : `$${Math.abs(d.valueVar).toFixed(0)}`}</span>,
        run: () => openDiscrepancy(d.id),
      });
    }

    // Jump to
    items.push({ id: 'jump:overview', group: 'Jump to', icon: LayoutDashboard, label: 'Reconciliation overview', keywords: 'jump overview dashboard home kpi trend', run: () => { onJump('overview'); onClose(); } });
    items.push({ id: 'jump:queue', group: 'Jump to', icon: ScanBarcode, label: 'Discrepancy queue', keywords: 'jump queue discrepancies table triage', run: () => { onJump('discrepancies'); onClose(); } });

    // Warehouse switch
    for (const s of SITES) {
      items.push({
        id: `site:${s.id}`,
        group: 'Switch warehouse',
        icon: Warehouse,
        label: `${s.code} — ${s.name}`,
        keywords: `warehouse site ${s.code} ${s.name} switch`,
        hint: s.id === siteId ? <Check size={12} className="text-amber" aria-label="Current warehouse" /> : undefined,
        run: () => { onSiteChange(s.id); onClose(); },
      });
    }

    // Actions
    items.push({ id: 'act:refresh', group: 'Actions', icon: RefreshCw, label: 'Force refresh WMS feed', keywords: 'refresh sync force feed wms poll', hint: <kbd className="key">R</kbd>, run: () => { window.dispatchEvent(new Event('recon:force-refresh')); onClose(); } });
    items.push({ id: 'act:export', group: 'Actions', icon: Download, label: 'Export discrepancy queue (CSV)', keywords: 'export csv download queue all', run: () => { onExportQueue(); onClose(); } });
    if (firstCritical) {
      items.push({
        id: 'act:open-critical', group: 'Actions', icon: TriangleAlert,
        label: `Open first critical (${firstCritical.id})`,
        keywords: `open critical first investigate ${firstCritical.id}`,
        hint: <span className="font-mono text-[12px] text-bad">{firstCritical.id}</span>,
        run: () => { onOpenDiscrepancy(firstCritical.id); onClose(); },
      });
    }
    for (const d of [7, 28, 90] as RangeDays[]) {
      items.push({
        id: `range:${d}`, group: 'Actions', icon: ChevronRight,
        label: `Show last ${d} days`,
        keywords: `range window ${d} days 7d 28d 90d period`,
        hint: rangeDays === d ? <Check size={12} className="text-amber" aria-label="Current range" /> : undefined,
        run: () => { onRangeChange(d); onClose(); },
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, recents, siteId, rangeDays, firstCritical]);

  const { groups, flat } = useMemo(() => {
    const q = query.trim();
    const scored: { item: Item; idxs: number[]; score: number }[] = [];
    for (const item of allItems) {
      let targets = [item.label, item.keywords];
      if (q && !item.group.includes('Discrepancy') && item.group !== 'Recent') {
        // nav/action items: match on label only, softer
        const idxs = fuzzyIndices(q, item.label);
        if (idxs) scored.push({ item, idxs, score: scoreOf(idxs) });
        continue;
      }
      for (const t of targets) {
        const idxs = fuzzyIndices(q, t);
        if (idxs) { scored.push({ item, idxs: t === item.label ? idxs : [], score: scoreOf(idxs) - (t === item.label ? 0 : 3) }); break; }
      }
    }
    scored.sort((a, b) => b.score - a.score);
    // cap discrepancy matches
    const disc = scored.filter((s) => s.item.group === 'Discrepancy').slice(0, 6);
    const rest = scored.filter((s) => s.item.group !== 'Discrepancy');
    const ordered = q ? [...disc, ...rest] : scored.map((s) => ({ ...s }));
    const map = new Map<string, { item: Item; idxs: number[] }[]>();
    for (const s of ordered) {
      const list = map.get(s.item.group) ?? [];
      list.push({ item: s.item, idxs: s.idxs });
      map.set(s.item.group, list);
    }
    const groupOrder = ['Recent', 'Jump to', 'Discrepancy', 'Switch warehouse', 'Actions'];
    const groups = groupOrder.filter((g) => map.has(g)).map((g) => ({ name: g, items: map.get(g)! }));
    const flat = groups.flatMap((g) => g.items);
    return { groups, flat };
  }, [allItems, query]);

  useEffect(() => { setActive(0); }, [query]);

  // scroll active option into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(flat.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.item.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-label="Close command palette" tabIndex={-1} />
      <div
        ref={paletteTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="absolute left-1/2 top-[12vh] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-edge2 bg-panel2 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-edge px-4">
          <Search size={16} className="shrink-0 text-amber" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={flat[active] ? `palette-opt-${active}` : undefined}
            aria-label="Command palette — search discrepancies, jump, or run actions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a ref, SKU, item, location, action…"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="h-14 w-full bg-transparent text-[16px] text-text outline-none placeholder:text-faint"
          />
          {query && (
            <button onClick={() => setQuery('')} className="key shrink-0" aria-label="Clear query">clear</button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[54vh] overflow-y-auto overscroll-contain p-2" role="listbox" id="palette-listbox" aria-label="Results" ref={listRef}>
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] font-medium text-text">Nothing matches “{query.trim()}”</p>
              <p className="mt-1 text-[12px] text-faint">Try a ref (RC-), SKU-, location like PKA-07 or an action like “export”</p>
            </div>
          ) : groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name} className="mb-1">
              <div aria-hidden="true" className="px-3 pb-1 pt-2 text-[12px] font-medium text-faint">{group.name}</div>
              {group.items.map(({ item, idxs }) => {
                flatIndex += 1;
                const idx = flatIndex;
                const isActive = idx === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    role="option"
                    id={`palette-opt-${idx}`}
                    data-index={idx}
                    aria-selected={isActive}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => item.run()}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors duration-75 ${isActive ? 'bg-panel3' : ''}`}
                  >
                    <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${isActive ? 'text-amber' : 'text-faint'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-text">
                      <Highlighted text={item.label} indices={idxs} />
                    </span>
                    {item.hint && <span className="shrink-0">{item.hint}</span>}
                    {isActive && <CornerDownLeft size={12} className="shrink-0 text-faint" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-edge bg-panel3/40 px-4 py-2">
          <span className="tnum font-mono text-[12px] text-faint">{flat.length} result{flat.length === 1 ? '' : 's'} · {modKeyLabel}</span>
          <span className="flex items-center gap-1.5 text-[12px] text-faint">
            <kbd className="key">↑</kbd><kbd className="key">↓</kbd> navigate
            <kbd className="key">↵</kbd> select
            <kbd className="key">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
