import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { modKeyLabel } from '../lib/platform';
import { useFocusTrap } from '../lib/useFocusTrap';

const ROWS: [string, string][] = [
  [`${modKeyLabel} K`, 'Toggle command palette'],
  ['/', 'Focus discrepancy search'],
  ['R', 'Force refresh the WMS feed'],
  ['↑ ↓', 'Move between rows in the table'],
  ['Enter', 'Open the focused discrepancy'],
  ['Esc', 'Close palette, drawer or popover'],
  ['?', 'Toggle this help'],
];

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close keyboard shortcuts"
        tabIndex={-1}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="absolute left-1/2 top-[12vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-edge2 bg-panel2 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard size={15} className="text-amber" aria-hidden="true" />
            <h2 id="shortcuts-title" className="text-[13px] font-semibold text-text">Keyboard shortcuts</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="rounded-lg border border-edge p-1.5 text-dim transition-colors hover:border-edge2 hover:text-text"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-edge/60">
              <th scope="col" className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">Key</th>
              <th scope="col" className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">Action</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([key, action]) => (
              <tr key={key} className="border-b border-edge/30 last:border-b-0">
                <th scope="row" className="px-4 py-2">
                  <kbd className="key">{key}</kbd>
                </th>
                <td className="px-4 py-2 text-[12px] text-text">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-edge/60 px-4 py-2 text-[10px] text-faint">
          Shortcuts are inert while a text field is focused.
        </p>
      </div>
    </div>
  );
}
