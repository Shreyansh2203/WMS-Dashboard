import { memo } from 'react';
import { OctagonAlert, TrendingUp, TrendingDown, MapPin, ScanLine, UserRoundX, ArrowRight } from 'lucide-react';
import ChartCard from './ChartCard';
import type { Insight } from '../data/mock';

const TONE_DOT: Record<Insight['tone'], string> = {
  bad: 'var(--color-bad)',
  warn: 'var(--color-amber)',
  good: 'var(--color-good)',
  info: 'var(--color-info)',
};

function iconFor(insight: Insight) {
  const t = insight.title.toLowerCase();
  if (t.includes('accuracy')) return insight.tone === 'good' ? TrendingUp : TrendingDown;
  if (t.includes('unassigned')) return UserRoundX;
  if (t.includes('mislocation')) return ScanLine;
  if (t.includes('holds')) return MapPin;
  return OctagonAlert;
}

interface InsightsProps {
  insights: Insight[];
  /** Jump to the queue filtered by the insight's action query. */
  onAction: (query: string) => void;
}

const rowClass =
  'group flex w-full items-start gap-3 divide-y divide-edge/70 py-2.5 text-start transition-colors first:pt-0 last:pb-0 hover:bg-panel2 focus-visible:bg-panel2';

export default memo(function Insights({ insights, onAction }: InsightsProps) {
  const actionable = insights.filter((i) => i.action).length;
  return (
    <ChartCard
      className="h-full"
      title="Signals worth acting on"
      subtitle="Worst miss first. Every actionable signal jumps to the filtered queue."
      right={
        <span className="text-[12px] font-medium text-faint">
          {insights.length} threshold{insights.length === 1 ? '' : 's'} · {actionable} actionable
        </span>
      }
      bodyClassName="flex flex-col"
    >
      <ol className="flex flex-1 flex-col divide-y divide-edge/70">
        {insights.map((ins, i) => {
          const Icon = iconFor(ins);
          const body = (
            <>
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_DOT[ins.tone] }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="pretty text-[12px] font-semibold leading-snug text-text">{ins.title}</p>
                <p className="pretty mt-1 text-[12px] leading-snug text-dim">{ins.detail}</p>
                {ins.action && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-amber transition-colors group-hover:text-text">
                    {ins.action.label} <ArrowRight size={11} className="flip-rtl" aria-hidden="true" />
                  </span>
                )}
              </div>
              {ins.action ? (
                <ArrowRight size={15} strokeWidth={1.75} className="flip-rtl mt-0.5 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber" aria-hidden="true" />
              ) : (
                <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
              )}
            </>
          );
          const key = `${i}-${ins.title.slice(0, 12)}`;
          return ins.action ? (
            <li key={key}>
              <button type="button" onClick={() => onAction(ins.action!.query)} className={rowClass}>
                {body}
              </button>
            </li>
          ) : (
            <li key={key} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">{body}</li>
          );
        })}
      </ol>
    </ChartCard>
  );
});
