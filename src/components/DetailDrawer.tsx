import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Copy, Check, CircleCheck, ScanLine, Calculator, UserRound, ClipboardCheck, PackageX, ChevronDown,
} from 'lucide-react';
import { ROOT_CAUSES, ASSIGNABLE as ASSIGNEES, skuVarianceHistory, type Discrepancy } from '../data/mock';
import { fmtDateFull, timeAgo, varWord } from '../lib/format';
import { useFocusTrap } from '../lib/useFocusTrap';

interface DetailDrawerProps {
  record: Discrepancy;
  onClose: () => void;
  onResolve: (id: string, rootCause: string) => void;
  onStartInvestigation: (id: string) => void;
  onAssignOwner: (id: string, owner: string | null) => void;
}

const sevLabel: Record<Discrepancy['severity'], string> = {
  Critical: 'pill pill-critical', High: 'pill pill-high', Medium: 'pill pill-medium', Low: 'pill pill-low',
};
const statusLabel: Record<Discrepancy['status'], string> = {
  Open: 'pill pill-open', Investigating: 'pill pill-invest', Resolved: 'pill pill-resolved',
};

export default function DetailDrawer({ record, onClose, onResolve, onStartInvestigation, onAssignOwner }: DetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rootCause, setRootCause] = useState('');
  useEffect(() => { setConfirming(false); setRootCause(''); }, [record.id]);
  const triggerRef = useRef<Element | null>(null);
  const panelRef = useFocusTrap<HTMLElement>(true);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // focus management: focus close on mount; on unmount restore to the Ref button that opened us
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const recordId = record.id;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      const origin = document.querySelector<HTMLElement>(`[data-ref-id="${recordId}"]`);
      if (origin) origin.focus();
      else (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [record.id]);

  const history = useMemo(() => skuVarianceHistory(record.id), [record.id]);
  const maxHist = Math.max(1, ...history.map((h) => Math.abs(h.varQty)));
  const valuePositive = record.valueVar >= 0;
  const resolved = record.status === 'Resolved';
  const resolvedAt = record.resolvedAt ?? record.detectedAt + (26 + (record.id.charCodeAt(3) % 30)) * 3_600_000;

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(record.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Location', value: <span className="font-mono">{record.location} <span className="text-faint">· {record.zoneName}</span></span> },
    { label: 'Detected', value: <span>{fmtDateFull(record.detectedAt)} <span className="text-faint">({timeAgo(record.detectedAt)})</span></span> },
    { label: 'Owner', value: (
      <span className="relative inline-block w-full max-w-[190px]">
        <select
          aria-label="Assign owner"
          value={record.owner ?? ''}
          onChange={(e) => onAssignOwner(record.id, e.target.value || null)}
          className="h-7 w-full appearance-none rounded-md border border-edge bg-panel3 ps-1.5 pe-6 text-[12px] font-medium text-text transition-colors hover:border-edge2 focus:border-amber/50"
        >
          <option value="">Unassigned</option>
          {ASSIGNEES.map((o) => <option key={o} value={o}>{o}{o === 'J. Kowalski' ? ' (you)' : ''}</option>)}
        </select>
        <ChevronDown size={11} aria-hidden="true" className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-faint" />
      </span>
    ) },
    { label: 'Root cause', value: record.rootCause ?? <span className="text-faint">Pending investigation</span> },
    { label: 'Unit cost', value: <span className="tnum font-mono">${record.unitCost.toFixed(2)}</span> },
    { label: 'Category', value: <span>{record.category} <span className="text-faint">·</span> <span className="font-mono text-[12px]">{record.abc}-class</span></span> },
  ];

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      {/* Scrim */}
      <button className="anim-overlay absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-label="Close detail panel" tabIndex={-1} />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="anim-drawer absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col border-s border-edge2 bg-panel shadow-[0_0_64px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span id="drawer-title" className="font-mono text-[17px] font-semibold tracking-tight text-text">{record.id}</span>
              <span className={sevLabel[record.severity]}><span className="dot" />{record.severity}</span>
              <span className={statusLabel[record.status]}><span className="dot" />{record.status}</span>
            </div>
            <p className="mt-1.5 text-[12px] font-medium text-dim">{record.type} · booked by blind count wave CC-2026-W45</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close"
            className="rounded-lg border border-edge p-2 text-dim transition-colors hover:border-edge2 hover:text-text">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {/* Item */}
          <div>
            <div className="font-mono text-[12px] font-medium tracking-[0.04em] text-faint">{record.sku}</div>
            <h2 className="mt-0.5 text-[16px] font-semibold leading-snug text-text">{record.item}</h2>
          </div>

          {/* Big numbers */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'System qty', value: record.systemQty.toLocaleString(), cls: 'text-text' },
              { label: 'Counted qty', value: record.countedQty.toLocaleString(), cls: 'text-text' },
              { label: 'Variance', value: `${record.varQty > 0 ? '+' : ''}${record.varQty.toLocaleString()}`, cls: record.varQty < 0 ? 'text-bad' : 'text-text' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-xl border border-edge bg-panel2 p-3">
                <div className="text-[12px] font-medium text-dim">{label}</div>
                <div className={`tnum mt-1.5 font-mono text-[22px] font-semibold leading-none ${cls}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Value impact */}
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <PackageX size={15} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden="true" />
              <div>
                <div className="text-[12px] font-medium text-dim">Variance value</div>
                <div className="mt-0.5 text-[12px] text-faint">{varWord(record.varQty)} · {record.countedQty === 0 && record.varQty < 0 ? 'full slot unaccounted' : 'vs system on hand'}</div>
              </div>
            </div>
            <div className={`tnum font-mono text-[19px] font-semibold ${valuePositive ? 'text-text' : 'text-bad'}`}>
              {valuePositive ? '+' : '−'}${Math.abs(record.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Variance history */}
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-[12px] font-medium text-dim">Variance history · last 6 counts</h4>
              <span className="text-[12px] text-faint">units vs system</span>
            </div>
            <div className="space-y-1 rounded-xl border border-edge bg-panel2 p-3">
              {history.map((h) => {
                const pct = (Math.abs(h.varQty) / maxHist) * 50;
                return (
                  <div key={h.label} className="grid grid-cols-[44px_1fr_34px] items-center gap-2" title={`${h.label}: ${h.varQty >= 0 ? '+' : ''}${h.varQty} units`}>
                    <span className="font-mono text-[12px] text-faint">{h.label}</span>
                    <div className="relative h-4">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-edge2" />
                      {h.varQty !== 0 && (
                        <div
                          className={`absolute top-1/2 h-[10px] -translate-y-1/2 rounded-[3px] ${h.varQty < 0 ? 'right-1/2 bg-bad/75' : 'left-1/2 bg-dim/70'}`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                    <span className={`tnum text-right font-mono text-[12px] ${h.varQty === 0 ? 'text-faint' : h.varQty < 0 ? 'text-bad' : 'text-text'}`}>
                      {h.varQty === 0 ? 'match' : `${h.varQty > 0 ? '+' : ''}${h.varQty}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meta grid */}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            {meta.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[12px] font-medium text-dim">{label}</dt>
                <dd className="mt-1 text-[12px] leading-snug text-text">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Timeline */}
          <div className="mt-5">
            <h4 className="mb-2 text-[12px] font-medium text-dim">Progress</h4>
            <ol className="relative ms-2 border-s border-edge2 ps-5">
              <li className="relative pb-4">
                <span className="absolute -start-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-edge2 bg-panel3">
                  <ScanLine size={11} className="text-dim" aria-hidden="true" />
                </span>
                <div className="text-[12px] font-medium text-text">Variance detected</div>
                <div className="font-mono text-[12px] text-faint">{fmtDateFull(record.detectedAt)}</div>
              </li>
              <li className="relative pb-4">
                <span className="absolute -start-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-edge2 bg-panel3">
                  <Calculator size={11} className="text-dim" aria-hidden="true" />
                </span>
                <div className="text-[12px] font-medium text-text">Auto-booked to reconciliation ledger</div>
                <div className="font-mono text-[12px] text-faint">{fmtDateFull(record.detectedAt + 2 * 3_600_000)} · variance written as unposted adjustment</div>
              </li>
              {record.status === 'Open' ? (
                <li className="relative">
                  <span className="absolute -start-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-faint bg-panel">
                    <UserRound size={11} className="text-faint" aria-hidden="true" />
                  </span>
                  <div className="text-[12px] font-medium text-faint">Awaiting owner. Assign above</div>
                </li>
              ) : (
                <li className="relative pb-4">
                  <span className="absolute -start-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-info/40 bg-info/10">
                    <UserRound size={11} className="text-info" aria-hidden="true" />
                  </span>
                  <div className="text-[12px] font-medium text-text">Assigned to {record.owner}</div>
                  <div className="font-mono text-[12px] text-faint">{fmtDateFull(record.detectedAt + 5 * 3_600_000)}</div>
                </li>
              )}
              {resolved && (
                <li className="relative">
                  <span className="absolute -start-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-good/40 bg-good/10">
                    <ClipboardCheck size={11} className="text-good" aria-hidden="true" />
                  </span>
                  <div className="text-[12px] font-medium text-text">Resolved · root cause: {record.rootCause}</div>
                  <div className="font-mono text-[12px] text-faint">{fmtDateFull(resolvedAt)} · adjustment posted to GL 5310</div>
                </li>
              )}
            </ol>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-edge bg-panel2/50 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {confirming ? (
            <fieldset>
              <legend className="text-[12px] font-semibold text-text">Resolve discrepancy. Variance posts to GL 5310</legend>
              <label className="mt-1.5 block text-[12px] font-medium text-dim" htmlFor="drawer-root-cause">Root cause is required</label>
              <select
                id="drawer-root-cause"
                autoFocus
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                className="mt-1 h-9 w-full appearance-none rounded-lg border border-edge bg-panel3 px-2 text-[12px] font-medium text-text focus:border-amber/50"
              >
                <option value="">Select root cause…</option>
                {ROOT_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => { setConfirming(false); setRootCause(''); }}
                  className="h-9 rounded-lg border border-edge px-3 text-[12px] font-semibold text-dim transition-colors hover:border-edge2 hover:text-text">
                  Cancel
                </button>
                <button type="button" disabled={!rootCause}
                  onClick={() => { if (!rootCause) return; onResolve(record.id, rootCause); setConfirming(false); setRootCause(''); }}
                  className="h-9 flex-1 rounded-lg bg-amber text-[12px] font-semibold text-[#1B1408] transition-colors hover:bg-amber-deep disabled:cursor-not-allowed disabled:opacity-40">
                  Post adjustment · {record.id}
                </button>
              </div>
            </fieldset>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={copyRef}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12px] font-semibold text-dim transition-colors hover:border-edge2 hover:text-text">
                {copied ? <Check size={13} className="text-good" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy ref'}
              </button>
              {record.status === 'Open' && (
                <button onClick={() => onStartInvestigation(record.id)}
                  className="h-9 rounded-lg border border-info/40 bg-info/10 px-3 text-[12px] font-semibold text-info transition-colors hover:bg-info/15">
                  Start investigating
                </button>
              )}
              <button
                onClick={() => setConfirming(true)}
                disabled={resolved}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-[12px] font-semibold transition-colors ${
                  resolved
                    ? 'cursor-default border border-good/30 bg-good/10 text-good'
                    : 'bg-amber text-[#1B1408] transition-colors hover:bg-amber-deep'
                }`}
              >
                {resolved ? <><Check size={14} aria-hidden="true" /> Resolved</> : <><CircleCheck size={14} aria-hidden="true" /> Mark resolved…</>}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
