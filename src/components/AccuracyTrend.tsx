import { useMemo } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import ChartDataTable from './ChartDataTable';
import type { DayPoint } from '../data/mock';
import { fmtInt, fmtMoneyCompact, fmtSignedPts } from '../lib/format';

const ACCURACY_TARGET = 98.5;

interface AccuracyTrendProps {
  series: DayPoint[];
  rangeDays: number;
}

export default function AccuracyTrend({ series, rangeDays }: AccuracyTrendProps) {
  const data = useMemo(() => {
    const current = series.slice(-rangeDays);
    const prior = series.slice(-rangeDays * 2, -rangeDays);
    return current.map((d, i) => ({
      label: d.label,
      ts: d.ts,
      accuracy: d.accuracy,
      prior: prior[i]?.accuracy ?? null,
      countsDone: d.countsDone,
      varianceValue: d.varianceValue,
    }));
  }, [series, rangeDays]);

  const minAccuracy = Math.min(...data.map((d) => d.accuracy));
  const yMin = Math.floor((minAccuracy - 0.2) * 2) / 2;
  const latest = data.at(-1);
  const first = data[0];

  return (
    <ChartCard
      className="h-full"
      title="Inventory accuracy trend"
      subtitle={`Match rate of system vs blind count, vs prior ${rangeDays} days (dashed)`}
      right={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[12px] font-medium text-dim">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-text" />This period</span>
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 border-t-2 border-dashed border-faint" />Prior</span>
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 border-t-2 border-dashed border-amber" />Target {ACCURACY_TARGET}%</span>
        </div>
      }
    >
      <div className="h-[268px] w-full" role="img" aria-label={`Daily inventory accuracy over the last ${rangeDays} days: ${first?.accuracy.toFixed(2)} percent at the start, ${latest?.accuracy.toFixed(2)} percent on the final day, shown against a dashed prior-period line and the ${ACCURACY_TARGET} percent target. The KPI above is the window average, not the endpoint.`}>
        <ResponsiveContainer width="100%" height="100%" minHeight={268}>
          <ComposedChart data={data} accessibilityLayer={false} margin={{ top: 10, right: 2, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="accuracy-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ECE8DF" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#ECE8DF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#26231F" strokeDasharray="2 7" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9B968C', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
              dy={6}
              padding={{ left: 14, right: 22 }}
            />
            <YAxis
              domain={[yMin, 100.0]}
              tick={{ fill: '#9B968C', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              width={50}
            />
            <Tooltip
              cursor={{ stroke: '#3B3831', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <ChartTooltip
                    title={new Date(p.ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    rows={[
                      { label: 'Accuracy', value: `${p.accuracy.toFixed(2)}%`, strong: true },
                      ...(p.prior != null
                        ? [{ label: 'Prior period', value: `${p.prior.toFixed(2)}%` },
                           { label: 'Δ vs prior', value: fmtSignedPts(p.accuracy - p.prior) }]
                        : []),
                      { label: 'Counts done', value: fmtInt(p.countsDone) },
                      { label: 'Variance value', value: fmtMoneyCompact(p.varianceValue) },
                    ]}
                  />
                );
              }}
            />
            <ReferenceLine
              y={ACCURACY_TARGET}
              stroke="#F2B33D"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{ value: `Target ${ACCURACY_TARGET}%`, position: 'insideTopRight', fill: '#F2B33D', fontSize: 11, fontFamily: 'IBM Plex Mono', dy: -2 }}
            />
            <Line
              type="monotone"
              dataKey="prior"
              name="Prior period"
              stroke="#7E7A72"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              name="This period"
              stroke="#ECE8DF"
              strokeWidth={2.4}
              fill="url(#accuracy-fill)"
              dot={(props: { index?: number; cx?: number; cy?: number }) =>
                props.index === data.length - 1
                  ? <circle key={`endpoint-${props.index}`} cx={props.cx} cy={props.cy} r={3.5} fill="#F2B33D" stroke="#14110F" strokeWidth={1.5} />
                  : <g key={`endpoint-${props.index}`} />
              }
              activeDot={{ r: 4, strokeWidth: 0, fill: '#F2B33D' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Data table disclosure — the accessible alternative to the role="img" summary */}
      <ChartDataTable
        caption={`Data table — accuracy, daily (${data.length} rows)`}
        head={[{ label: 'Date' }, { label: 'Accuracy', align: 'right' }, { label: 'Prior period', align: 'right' }]}
        rows={data.map((d) => [
          new Date(d.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          `${d.accuracy.toFixed(2)}%`,
          d.prior != null ? `${d.prior.toFixed(2)}%` : '—',
        ])}
      />
    </ChartCard>
  );
}
