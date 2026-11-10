import { LayoutDashboard, TableProperties, ScanBarcode } from 'lucide-react';

export type View = 'overview' | 'discrepancies';

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  unresolvedCount: number;
  waveProgress: number;
}

export default function Sidebar({ view, onNavigate, unresolvedCount, waveProgress }: SidebarProps) {
  const items: { id: View; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'discrepancies', label: 'Discrepancies', icon: TableProperties, badge: unresolvedCount },
  ];

  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-s border-edge bg-rail lg:flex">
      {/* Brand — scan glyph is the signature */}
      <div className="flex items-center gap-3 border-b border-edge px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-amber" aria-hidden="true">
          <ScanBarcode size={19} strokeWidth={2.1} className="text-on-amber" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-text">Recon</div>
          <div className="text-[12px] text-faint">WMS reconciliation</div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Primary" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <ul className="space-y-0.5">
          {items.map(({ id, label, icon: Icon, badge }) => {
            const active = view === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onNavigate(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors ${
                    active ? 'bg-panel3 text-amber shadow-[inset_0_0_0_1px_var(--color-edge2)]' : 'text-dim hover:bg-panel2 hover:text-text'
                  }`}
                >
                  <Icon size={16} strokeWidth={active ? 2 : 1.75} className={`shrink-0 ${active ? 'text-amber' : 'text-faint group-hover:text-dim'}`} aria-hidden="true" />
                  <span className="flex-1 text-start font-medium">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <>
                      {' '}
                      <span className="tnum rounded-md bg-panel2 px-1.5 py-0.5 font-mono text-[12px] font-medium text-amber group-[.active]:bg-transparent">
                        {badge}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Count wave coverage — quiet, text-first */}
      <div className="border-t border-edge p-4">
        <div className="rounded-xl border border-edge bg-panel2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-text">Wave CC-2026-W45</span>
            <span className="tnum font-mono text-[12px] font-semibold text-amber">{waveProgress.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel3" role="progressbar" aria-valuenow={Math.round(waveProgress)} aria-valuemin={0} aria-valuemax={100} aria-label="Pick slots counted in count wave CC-2026-W45">
            <div className="h-full w-full origin-left rounded-full bg-amber transition-transform duration-500" style={{ transform: `scaleX(${Math.min(1, Math.max(0, waveProgress / 100))})` }} />
          </div>
          <p className="pretty mt-2 text-[12px] leading-snug text-faint">8 zones · due Fri 17:00</p>
        </div>
        <p className="mt-3 whitespace-nowrap px-1 font-mono text-[12px] text-faint">Recon v2.4.1 · SOC 2 Type II</p>
      </div>
    </aside>
  );
}
