import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CircleCheck, Database, Timer, Layers, ZapOff } from 'lucide-react';

export type StreamState = 'live' | 'syncing' | 'stale' | 'offline';

const SLA_SECONDS = 300;
const OFFLINE_SECONDS = SLA_SECONDS * 3;

interface StreamWatchdogProps {
  siteCode: string;
  rowsApplied: number;
  onToast: (message: string) => void;
  /** Keeps the shell's freshness banner honest. */
  onStateChange?: (state: StreamState) => void;
}

function fmtAgo(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s ago`;
  const m = Math.floor(totalSeconds / 60);
  return `${m}m ${totalSeconds % 60}s ago`;
}

export default function StreamWatchdog({ siteCode, rowsApplied, onToast, onStateChange }: StreamWatchdogProps) {
  const [state, setState] = useState<StreamState>('live');
  const [lastSync, setLastSync] = useState(() => Date.now() - 14_000);
  const [secondsAgo, setSecondsAgo] = useState(14);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const refreshTimer = useRef<number>(0);

  // tick every second — paused while hidden (window-focus awareness)
  useEffect(() => {
    const update = () => {
      if (document.hidden) return;
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastSync) / 1000)));
    };
    update();
    const onVisible = () => { if (!document.hidden) { setLastSync(Date.now()); } };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(update, 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(t);
    };
  }, [lastSync]);

  const state_: StreamState = state === 'syncing'
    ? 'syncing'
    : secondsAgo > OFFLINE_SECONDS
      ? 'offline'
      : secondsAgo > SLA_SECONDS
        ? 'stale'
        : 'live';

  // let the shell know so it can render the freshness banner
  useEffect(() => { onStateChange?.(state_); }, [state_, onStateChange]);

  // exponential backoff while offline (2s → 4s → 8s → 16s → cap 30s)
  useEffect(() => {
    if (state_ !== 'offline') { setRetryAttempt(0); return; }
    const delay = Math.min(30, 2 ** Math.max(1, retryAttempt + 1));
    if (retryAttempt >= 8) return; // stop hammering; manual retry via banner
    const t = window.setTimeout(() => {
      setRetryAttempt((n) => n + 1);
      forceRefresh();
    }, delay * 1000);
    return () => window.clearTimeout(t);
  }, [state_, retryAttempt]);

  const forceRefresh = useCallback(() => {
    if (state === 'syncing') return;
    setState('syncing');
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      setLastSync(Date.now());
      setSecondsAgo(0);
      setState('live');
      onToast('WMS feed restored. Live data resumed');
    }, 1400);
  }, [state, onToast]);

  // expose to global "R" shortcut
  useEffect(() => {
    const handler = () => forceRefresh();
    window.addEventListener('recon:force-refresh', handler);
    return () => window.removeEventListener('recon:force-refresh', handler);
  }, [forceRefresh]);

  // popover dismissal
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // move focus into the non-modal dialog so screen readers announce it
  useEffect(() => { if (open) popRef.current?.focus(); }, [open]);

  const dot = state_ === 'live' ? 'var(--color-good)' : state_ === 'syncing' ? 'var(--color-amber)' : state_ === 'stale' ? 'var(--color-amber)' : 'var(--color-bad)';
  const label = state_ === 'live' ? 'Live' : state_ === 'syncing' ? 'Syncing…' : state_ === 'stale' ? 'Stale' : 'Offline';
  const sub = state_ === 'live' ? fmtAgo(secondsAgo) : state_ === 'syncing' ? 'polling WMS…' : state_ === 'stale' ? `last confirmed ${fmtAgo(secondsAgo)}` : 'connection lost';

  return (
    <div className="static sm:relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="stream-health-panel"
        title="Open sync details"
        className="flex h-9 items-center gap-2 rounded-full border border-edge bg-panel2 ps-2.5 pe-3 transition-colors hover:border-edge2"
      >
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span className="font-mono text-[12px] font-medium text-dim">
          <span style={{ color: dot }}>{label}</span>
          <span className="tnum hidden sm:inline"> · {sub}</span>
          <span className="sr-only">, open sync details</span>
        </span>
      </button>

      {open && (
        <div
          ref={popRef}
          id="stream-health-panel"
          role="dialog"
          aria-label="Stream health"
          tabIndex={-1}
          className="anim-pop absolute left-4 right-4 top-[60px] z-30 w-auto origin-top-right rounded-xl border border-edge2 bg-panel2 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.5)] outline-none sm:left-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[300px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text">Stream health</span>
            <span className="flex items-center gap-1 font-mono text-[12px] text-faint"><Timer size={10} aria-hidden="true" /> SLA 5m</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-faint"><Database size={11} aria-hidden="true" />Source</dt>
              <dd className="font-mono text-dim">wms-extract · recon-ledger</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-faint"><Layers size={11} aria-hidden="true" />Rows applied</dt>
              <dd className="tnum font-mono text-dim">{rowsApplied.toLocaleString()} discrepancies · {siteCode}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-faint"><CircleCheck size={11} aria-hidden="true" />Last packet</dt>
              <dd className="tnum font-mono text-dim">{state_ === 'syncing' ? 'in flight…' : fmtAgo(secondsAgo)}</dd>
            </div>
          </dl>
          {state_ === 'stale' && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber/30 bg-amber/[0.08] px-2 py-1.5 text-[12px] leading-snug text-amber">
              <ZapOff size={11} className="mt-0.5 shrink-0" aria-hidden="true" /> Feed past SLA. Numbers may be out of date. Force a refresh before acting.
            </p>
          )}
          {state_ === 'offline' && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-bad/30 bg-bad/[0.08] px-2 py-1.5 text-[12px] leading-snug text-bad">
              <ZapOff size={11} className="mt-0.5 shrink-0" aria-hidden="true" /> Connection lost. Last confirmed numbers shown; retrying with backoff (attempt {retryAttempt}).
            </p>
          )}
          <button
            onClick={forceRefresh}
            disabled={state_ === 'syncing'}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-edge bg-panel3 text-[12px] font-semibold text-text transition-colors hover:border-edge2 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={12} className={state_ === 'syncing' ? 'animate-spin' : ''} aria-hidden="true" />
            {state_ === 'syncing' ? 'Refreshing feed…' : 'Force refresh'}
            {state_ !== 'syncing' && <kbd className="key">R</kbd>}
          </button>
        </div>
      )}
    </div>
  );
}
