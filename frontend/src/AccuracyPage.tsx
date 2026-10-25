import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAccuracy, useVintages } from './api'
import { Card, ErrorBox, Loading, Panel, Segmented } from './components'
import { londonStamp, mw, shortDay, signedMw } from './format'

const OVER = '#dc2626'
const UNDER = '#0d9488'

export function AccuracyPage({ day, cutoff, onOpenDay }: { day: string; cutoff: string; onOpenDay: (d: string) => void }) {
  const [scope, setScope] = useState<'month' | 'day'>('month')
  const acc = useAccuracy(scope, day, cutoff)
  const vint = useVintages(cutoff)
  const [showGaps, setShowGaps] = useState(false)

  if (acc.isLoading) return <Loading label="Loading accuracy" />
  if (acc.error || !acc.data) return <ErrorBox error={acc.error ?? new Error('No data')} retry={() => acc.refetch()} />

  const { metrics: m, quality: q } = acc.data
  const daily = acc.data.daily.map((d) => ({ ...d, label: shortDay(d.day) }))
  const byHour = acc.data.by_hour.map((h) => ({
    ...h,
    label: String(h.hour).padStart(2, '0'),
    // ErrorBar takes distances from the bar value, not absolute ends.
    whisker: [h.bias - h.p10, h.p90 - h.bias],
  }))
  const direction = m ? (m.bias > 0 ? 'over-forecast' : 'under-forecast') : ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'day', label: `Selected day (${shortDay(day)})` },
          ]}
        />
        <p className="text-xs text-slate-500">{acc.data.sample_note}</p>
      </div>

      {m ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card title="MAE">{mw(m.mae)} MW</Card>
          <Card title="RMSE">{mw(m.rmse)} MW</Card>
          <Card title="Bias" sub={direction}>
            <span className={m.bias > 0 ? 'text-over' : 'text-under'}>{signedMw(m.bias)} MW</span>
          </Card>
          <Card title="P90 abs error">{mw(m.p90_abs)} MW</Card>
          <Card
            title="Hours matched"
            sub={
              q.missing.length ? (
                <button className="underline" onClick={() => setShowGaps((s) => !s)}>
                  {q.missing.length} gap(s) - show
                </button>
              ) : (
                'no gaps'
              )
            }
          >
            {q.matched_hours}/{q.expected_hours}
          </Card>
        </div>
      ) : (
        <div role="note" className="rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-600">
          No hours with both a forecast and an actual in this scope.
        </div>
      )}

      {showGaps && q.missing.length > 0 && (
        <ul className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {q.missing.map((g) => (
            <li key={g.hour}>
              {londonStamp(g.hour)} - {g.has_forecast ? '' : 'no forecast '}
              {g.has_actual ? '' : 'no actual'}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Daily error (bars: bias, line: MAE) - click a bar to open that day">
          <div className="h-72" role="img" aria-label="Daily signed bias and MAE for each delivery day">
            <ResponsiveContainer>
              <ComposedChart data={daily} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" interval={4} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} />
                <Tooltip formatter={(v) => `${signedMw(Number(v))} MW`} />
                <Legend />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="bias" name="Bias" isAnimationActive={false} onClick={(d) => onOpenDay((d as unknown as { day: string }).day)} cursor="pointer">
                  {daily.map((d) => (
                    <Cell key={d.day} fill={(d.bias ?? 0) > 0 ? OVER : UNDER} />
                  ))}
                </Bar>
                <Line dataKey="mae" name="MAE" stroke="#111827" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Error by hour of day (bars: bias, whiskers: P10-P90)">
          <div className="h-72" role="img" aria-label="Mean forecast error by hour of day with P10 to P90 range">
            <ResponsiveContainer>
              <BarChart data={byHour} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" interval={2} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} />
                <Tooltip formatter={(v) => (Array.isArray(v) ? '' : `${signedMw(Number(v))} MW`)} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="bias" name="Bias" isAnimationActive={false}>
                  {byHour.map((h) => (
                    <Cell key={h.hour} fill={h.bias > 0 ? OVER : UNDER} />
                  ))}
                  {scope === 'month' && <ErrorBar dataKey="whisker" stroke="#475569" width={3} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Does waiting help? Same hours, different information cutoffs">
        {vint.isLoading && <Loading />}
        {vint.error && <ErrorBox error={vint.error} retry={() => vint.refetch()} />}
        {vint.data && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-1">Forecast available at</th>
                <th className="text-right">MAE MW</th>
                <th className="text-right">Bias MW</th>
                <th className="text-right">Hours</th>
                <th className="pl-4">Usable for the decision?</th>
              </tr>
            </thead>
            <tbody>
              {vint.data.map((v) => (
                <tr key={v.label} className="border-b border-slate-100">
                  <td className="py-1">{v.label}</td>
                  <td className="text-right">{mw(v.metrics?.mae)}</td>
                  <td className="text-right">{signedMw(v.metrics?.bias)}</td>
                  <td className="text-right">{v.metrics?.n ?? '-'}</td>
                  <td className="pl-4">{v.status === 'usable' ? 'Yes' : 'No - published after the cutoff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
