import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Warehouse, ChevronDown, Check, Search, Bell, TriangleAlert, ArrowRight, X, Command,
} from 'lucide-react';
import { SITES, type Site, type Discrepancy } from '../data/mock';
import StreamWatchdog, { type StreamState } from './StreamWatchdog';
import { modKeyLabel } from '../lib/platform';

interface TopBarProps {
  site: Site;
  onSiteChange: (id: string) => void;
  siteUnresolved: Record<string, number>;
  rowsApplied: number;
  query: string;
  onQueryChange: (q: string) => void;
  onSearchSubmit: () => void;
  onOpenPalette: () => void;
  onToast: (msg: string) => void;
  criticalItems: Discrepancy[];
  onStreamStateChange?: (state: StreamState) => void;
  onOpenDiscrepancy: (id: string) => void;
  onViewAll: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

function usePopover(returnFocusRef?: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); returnFocusRef?.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export default function TopBar({
  site, onSiteChange, siteUnresolved, rowsApplied, query, onQueryChange, onSearchSubmit,
  onOpenPalette, onToast, criticalItems, onOpenDiscrepancy, onViewAll, searchRef, onStreamStateChange,
}: TopBarProps) {
  const siteBtnRef = useRef<HTMLButtonElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const bellPanelRef = useRef<HTMLDivElement>(null);
  const sitePop = usePopover(siteBtnRef);
  const bellPop = usePopover(bellBtnRef);

  useEffect(() => { if (bellPop.open) bellPanelRef.current?.focus(); }, [bellPop.open]);

  // arrow-key navigation inside the warehouse listbox
  const onSiteKeyDown = (e: React.KeyboardEvent) => {
    if (!sitePop.open) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sitePop.setOpen(false);
      siteBtnRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const current = SITES.findIndex((s) => s.id === site.id);
    const next = e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? SITES.length - 1
        : e.key === 'ArrowUp'
          ? (current - 1 + SITES.length) % SITES.length
          : (current + 1) % SITES.length;
    onSiteChange(SITES[next].id);
  };

  const attentionShown = criticalItems;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-edge bg-[#171512]/92 px-4 backdrop-blur-md sm:px-5">
      {/* Warehouse switcher */}
      <div className="relative min-w-0 shrink-0" ref={sitePop.ref} onKeyDown={onSiteKeyDown}>
        <button
          ref={siteBtnRef}
          id="site-switcher"
          role="combobox"
          onClick={() => sitePop.setOpen(!sitePop.open)}
          aria-expanded={sitePop.open}
          aria-haspopup="listbox"
          aria-controls="site-listbox"
          aria-labelledby="site-switcher-value"
          aria-activedescendant={sitePop.open ? `site-option-${site.id}` : undefined}
          className="flex h-9 max-w-[220px] items-center gap-2.5 rounded-lg border border-edge bg-panel2 ps-2 pe-1.5 transition-colors hover:border-edge2 sm:max-w-none sm:ps-2.5 sm:pe-2"
        >
          <Warehouse size={15} strokeWidth={1.75} className="shrink-0 text-amber" aria-hidden="true" />
          <span id="site-switcher-value" className="min-w-0 leading-tight">
            <span className="block truncate text-[12px] font-semibold text-text">{site.code} <span className="hidden md:inline text-dim font-normal">· {site.name}</span></span>
            {' '}
            <span className="hidden font-mono text-[12px] text-faint xl:block">{site.meta}</span>
          </span>
          <ChevronDown size={14} className={`shrink-0 text-faint transition-transform duration-200 ${sitePop.open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {sitePop.open && (
          <div id="site-listbox" role="listbox" aria-label="Switch warehouse" className="anim-pop absolute start-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-[320px] origin-top-left rounded-xl border border-edge2 bg-panel2 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.5)]">
            <div aria-hidden="true" className="px-2 pb-1.5 pt-1 text-[12px] font-medium text-faint">Switch warehouse</div>
            {SITES.map((s) => {
              const active = s.id === site.id;
              const unres = siteUnresolved[s.id] ?? 0;
              return (
                <button
                  key={s.id}
                  id={`site-option-${s.id}`}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  onClick={() => { onSiteChange(s.id); sitePop.setOpen(false); siteBtnRef.current?.focus(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-panel3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-semibold text-amber">{s.code}</span>
                      {active && <Check size={12} className="text-amber" aria-hidden="true" />}
                    </div>
                    <div className="truncate text-[12px] font-medium text-text">{s.name}</div>
                    <div className="text-[12px] text-faint">{s.meta}</div>
                  </div>
                  <span className="tnum shrink-0 rounded-md border border-edge bg-panel3 px-1.5 py-0.5 font-mono text-[12px] text-dim" title="Unresolved discrepancies">
                    {unres} open
                  </span>
                </button>
              );
            })}
            <p className="px-2 pb-1.5 pt-1 text-[12px] text-faint">Tip: <kbd className="key">↑</kbd> <kbd className="key">↓</kbd> switch · <kbd className="key">Enter</kbd> to select</p>
          </div>
        )}
      </div>

      {/* Search — / focuses, Enter jumps to the queue */}
      <form
        role="search"
        className="relative mx-auto hidden w-full max-w-md md:block"
        onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}
      >
        <Search size={13} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { onQueryChange(''); e.currentTarget.blur(); } }}
          placeholder="Search ref, SKU, item, zone, owner…"
          aria-label="Search discrepancies"
          spellCheck={false}
          autoComplete="off"
          className="h-8 w-full rounded-lg border border-edge bg-panel2 ps-9 pe-12 text-[16px] text-text placeholder:text-faint transition-colors focus:border-edge2 sm:text-[12px]"
        />
        {query ? (
          <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search"
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-faint hover:text-text">
            <X size={13} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="key pointer-events-none absolute end-2 top-1/2 -translate-y-1/2">/</kbd>
        )}
      </form>

      <div className="ms-auto flex shrink-0 items-center gap-1.5 md:ml-0">
        <StreamWatchdog siteCode={site.code} rowsApplied={rowsApplied} onToast={onToast} onStateChange={onStreamStateChange} />

        {/* Command palette — keyboard-first launcher */}
        <button
          onClick={onOpenPalette}
          aria-label={`Open command palette (${modKeyLabel})`}
          title={`Command palette (${modKeyLabel})`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-dim transition-colors hover:bg-panel2 hover:text-text"
        >
          <Command size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {/* Needs attention */}
        <div className="relative" ref={bellPop.ref}>
          <button
            ref={bellBtnRef}
            onClick={() => bellPop.setOpen(!bellPop.open)}
            aria-expanded={bellPop.open}
            aria-haspopup="dialog"
            aria-controls="attention-panel"
            aria-label={`Needs attention: ${criticalItems.length} critical unresolved`}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-dim transition-colors hover:bg-panel2 hover:text-text"
          >
            <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
            {criticalItems.length > 0 && <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-bad" aria-hidden="true" />}
          </button>

          {bellPop.open && (
            <div ref={bellPanelRef} id="attention-panel" tabIndex={-1} className="anim-pop absolute end-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-[340px] origin-top-right overflow-hidden rounded-xl border border-edge2 bg-panel2 shadow-[0_18px_48px_rgba(0,0,0,0.5)] outline-none" role="dialog" aria-label="Critical discrepancies needing attention">
              <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={12} className="text-amber" aria-hidden="true" />
                  <span className="text-[12px] font-semibold text-text">Needs attention</span>
                </div>
                <span className="text-[12px] font-medium text-faint">
                  {criticalItems.length === 0 ? 'Critical · all clear' : `${criticalItems.length} critical · unresolved`}
                </span>
              </div>
              {criticalItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[12px] font-medium text-text">All clear</p>
                  <p className="mt-0.5 text-[12px] text-faint">No critical discrepancies are open right now.</p>
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
                  {attentionShown.map((d) => (
                    <li key={d.id}>
                      <button onClick={() => { bellPop.setOpen(false); onOpenDiscrepancy(d.id); }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-panel3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[12px] font-semibold text-bad">{d.id}</span>
                            <span className="tnum font-mono text-[12px] text-dim">{d.valueVar >= 0 ? '+' : '−'}${Math.abs(d.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="truncate text-[12px] text-text">{d.item}</div>
                          <div className="font-mono text-[12px] text-faint">{d.location} · {d.zoneName}</div>
                        </div>
                        <ArrowRight size={13} className="flip-rtl shrink-0 text-faint" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => { bellPop.setOpen(false); onViewAll(); }}
                className="flex w-full items-center justify-center gap-1.5 border-t border-edge px-4 py-2.5 text-[12px] font-semibold text-amber transition-colors hover:bg-panel3">
                Open discrepancy queue <ArrowRight size={13} className="flip-rtl" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Account — identity chip; decorative, so it yields space on phones */}
        <button className="hidden h-9 w-9 items-center justify-center rounded-lg border border-edge bg-panel3 font-mono text-[12px] font-semibold text-dim transition-colors hover:text-text sm:flex"
          title="J. Kowalski — Inventory Control Lead" aria-label="JK — Inventory Control Lead">
          JK
        </button>
      </div>
    </header>
  );
}
