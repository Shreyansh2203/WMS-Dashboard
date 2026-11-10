import { useEffect, useRef } from 'react';
import { CircleCheck, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}

const LINGER_MS = 7000;

export default function Toast({ message, onUndo, onDismiss }: ToastProps) {
  const timer = useRef(0);

  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onDismiss, LINGER_MS);
  };
  const pause = () => window.clearTimeout(timer.current);

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) start(); }}
      className="anim-toast fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-edge2 bg-panel3 py-2.5 ps-3.5 pe-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <CircleCheck size={17} className="shrink-0 text-good" aria-hidden="true" />
      <p className="pretty min-w-0 flex-1 text-[12px] font-medium leading-snug text-text">{message}</p>
      {onUndo && (
        <button onClick={onUndo} className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-amber transition-colors hover:bg-amber/10">
          Undo
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:text-text">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
