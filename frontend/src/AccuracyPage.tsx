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
import { Badge, Callout, Card, ErrorBox, Loading, Panel, Segmented, SignLegend, TooltipBox } from './components'
import { londonStamp, mw, shortDay, signedMw } from './format'

const OVER = '#dc2626'
const UNDER = '#0d9488'

const axisLabel = { value: 'MW', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#64748b' } as const

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
  const scopeLabel = scope === 'month' ? 'the month' : shortDay(day)
  const usable = vint.data?.find((v) => v.status === 'usable' && v.label.startsWith('Your'))
  const latest = vint.data?.find((v) => v.status !== 'usable')
  const worstHour = [...byHour].sort((a, b) => b.bias - a.bias)[0]
  const bestHour = [...byHour].sort((a, b) => Math.abs(a.bias) - Math.abs(b.bias))[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

      {m && (
        <Callout>
          Over {scopeLabel}, the forecast available at the cutoff was off by <strong>{mw(m.mae)} MW</strong> on average, and it ran{' '}
          <strong>
            {mw(Math.abs(m.bias))} MW {m.bias > 0 ? 'too high' : 'too low'}
          </strong>{' '}
          ({direction}). {scope === 'month' && worstHour && `The largest over-forecast is at ${worstHour.label}:00 (${signedMw(worstHour.bias)} MW); the closest is at ${bestHour.label}:00 (${signedMw(bestHour.bias)} MW).`}
        </Callout>
      )}

      {m ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card title="MAE" sub="typical miss, either direction">
            {mw(m.mae)} MW
          </Card>
          <Card title="RMSE" sub="penalises big misses">
            {mw(m.rmse)} MW
          </Card>
          <Card title="Bias" tone={m.bias > 0 ? 'over' : 'under'} sub={`${direction} (forecast - actual)`}>
            <span className={m.bias > 0 ? 'text-over' : 'text-under'}>{signedMw(m.bias)} MW</span>
          </Card>
          <Card title="P90 abs error" sub="9 in 10 hours miss by less">
            {mw(m.p90_abs)} MW
          </Card>
          <Card
            title="Hours matched"
            sub={
              q.missing.length ? (
                <button className="underline" onClick={() => setShowGaps((s) => !s)}>
                  {q.missing.length} gap(s) - show
                </button>
              ) : (
                'no gaps, nothing interpolated'
              )
            }
          >
            {q.matched_hours}/{q.expected_hours}
          </Card>
        </div>
      ) : (
        <Callout tone="warn">No hours with both a forecast and an actual in this scope.</Callout>
      )}

      {showGaps && q.missing.length > 0 && (
        <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          {q.missing.map((g) => (
            <li key={g.hour}>
              {londonStamp(g.hour)} - {g.has_forecast ? '' : 'no forecast '}
              {g.has_actual ? '' : 'no actual'}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Daily error"
          subtitle="Bars: bias. Line: MAE. Click a bar to open that day on Decision."
          right={<SignLegend />}
        >
          <div className="h-72" role="img" aria-label="Daily signed bias and MAE for each delivery day">
            <ResponsiveContainer>
              <ComposedChart data={daily} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" interval={4} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tick={{ fontSize: 12 }} label={axisLabel} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    // Recharts types payload.payload as any; it is the row of `daily` we passed as data.
                    const r: (typeof daily)[number] = payload[0].payload
                    return (
                      <TooltipBox
                        title={r.label}
                        rows={[
                          { label: 'Bias', value: `${signedMw(r.bias)} MW`, color: (r.bias ?? 0) > 0 ? OVER : UNDER },
                          { label: 'MAE', value: `${mw(r.mae)} MW`, color: '#111827' },
                        ]}
                      />
                    )
                  }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar
                  dataKey="bias"
                  name="Bias"
                  isAnimationActive={false}
                  onClick={(_, i) => {
                    const clicked = daily[i]
                    if (clicked) onOpenDay(clicked.day)
                  }}
                  cursor="pointer"
                >
                  {daily.map((d) => (
                    <Cell key={d.day} fill={(d.bias ?? 0) > 0 ? OVER : UNDER} stroke={d.day === day ? '#0f172a' : undefined} strokeWidth={d.day === day ? 2 : 0} />
                  ))}
                </Bar>
                <Line dataKey="mae" name="MAE" stroke="#111827" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Error by hour of day"
          subtitle={scope === 'month' ? 'Bars: mean bias. Whiskers: P10 to P90 of the error.' : 'Mean bias for the selected day.'}
          right={<SignLegend />}
        >
          <div className="h-72" role="img" aria-label="Mean forecast error by hour of day with P10 to P90 range">
            <ResponsiveContainer>
              <BarChart data={byHour} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" interval={2} tick={{ fontSize: 12 }} label={{ value: 'Hour (London)', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#64748b' }} height={40} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tick={{ fontSize: 12 }} label={axisLabel} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    // Recharts types payload.payload as any; it is the row of `byHour` we passed as data.
                    const r: (typeof byHour)[number] = payload[0].payload
                    return (
                      <TooltipBox
                        title={`${r.label}:00`}
                        rows={[
                          { label: 'Mean bias', value: `${signedMw(r.bias)} MW`, color: r.bias > 0 ? OVER : UNDER },
                          { label: 'P10 / P90', value: `${signedMw(r.p10)} / ${signedMw(r.p90)} MW` },
                          { label: 'MAE', value: `${mw(r.mae)} MW` },
                          { label: 'Hours', value: String(r.n) },
                        ]}
                      />
                    )
                  }}
                />
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

      <Panel
        title="Does waiting help? Same hours, different information cutoffs"
        subtitle={
          usable?.metrics && latest?.metrics
            ? `Waiting until the latest pre-delivery forecast would cut MAE by ${mw(usable.metrics.mae - latest.metrics.mae)} MW, but that forecast is published after the auction closes, so it cannot be used.`
            : undefined
        }
      >
        {vint.isLoading && <Loading />}
        {vint.error && <ErrorBox error={vint.error} retry={() => vint.refetch()} />}
        {vint.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-1.5">Forecast available at</th>
                  <th className="text-right">MAE MW</th>
                  <th className="text-right">vs your cutoff</th>
                  <th className="text-right">Bias MW</th>
                  <th className="text-right">Hours</th>
                  <th className="pl-4">Usable for the decision?</th>
                </tr>
              </thead>
              <tbody>
                {vint.data.map((v) => {
                  const delta = v.metrics && usable?.metrics ? v.metrics.mae - usable.metrics.mae : null
                  const isYours = v === usable
                  return (
                    <tr key={v.label} className={`border-b border-slate-100 ${isYours ? 'bg-blue-50/60 font-medium' : ''}`}>
                      <td className="py-1.5">{v.label}</td>
                      <td className="text-right">{mw(v.metrics?.mae)}</td>
                      <td className={`text-right ${delta == null || isYours ? 'text-slate-400' : delta < 0 ? 'text-under' : 'text-over'}`}>
                        {isYours || delta == null ? '-' : signedMw(delta)}
                      </td>
                      <td className="text-right">{signedMw(v.metrics?.bias)}</td>
                      <td className="text-right">{v.metrics?.n ?? '-'}</td>
                      <td className="pl-4">
                        {v.status === 'usable' ? <Badge tone="good">Yes</Badge> : <Badge tone="bad">No - published after the cutoff</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
