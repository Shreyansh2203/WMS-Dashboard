interface TooltipRow {
  label: string;
  value: string;
  dot?: string; // hex color
  strong?: boolean;
}

export default function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-edge2 bg-panel2/95 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="mb-1.5 font-mono text-[12px] font-medium text-faint">{title}</div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-5 text-[12px] leading-none">
            <span className="flex items-center gap-1.5 text-dim">
              {row.dot && <span className="h-2 w-2 rounded-[3px]" style={{ background: row.dot }} />}
              {row.label}
            </span>
            <span className={`tnum font-mono ${row.strong ? 'font-semibold text-text' : 'text-text/90'}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
