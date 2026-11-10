import type { ReactNode } from 'react';

interface ChartDataTableProps {
  /** Visible disclosure label, e.g. "Data table, 28 rows". */
  caption: string;
  /** Column headers. Right align numeric columns. */
  head: { label: string; align?: 'left' | 'right' }[];
  /** Rows of cells. */
  rows: ReactNode[][];
  className?: string;
}

/**
 * The accessible alternative to a chart's role="img" summary: a collapsed
 * <details> disclosure holding the full per-datum table. Screen readers get
 * both; sighted users can expand it without leaving the card.
 */
export default function ChartDataTable({ caption, head, rows, className = '' }: ChartDataTableProps) {
  return (
    <details className={`mt-2 border-t border-edge pt-2 ${className}`}>
      <summary className="cursor-pointer select-none px-1 text-[12px] font-medium text-dim transition-colors hover:text-text">
        {caption}
      </summary>
      <div className="mt-1 max-h-64 overflow-y-auto overscroll-contain">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-panel2">
            <tr>
              {head.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  className={`px-3 py-1.5 font-mono text-[10px] font-medium text-faint ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} className="border-b border-edge/40 last:border-b-0">
                {cells.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="whitespace-nowrap px-3 py-1 text-[11px] font-normal text-text">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className={`tnum whitespace-nowrap px-3 py-1 text-[11px] ${head[j].align === 'right' ? 'text-right' : ''} text-dim`}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
