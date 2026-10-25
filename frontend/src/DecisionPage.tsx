import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDecision } from './api'
import { Card, ErrorBox, Loading, Panel, Toggle } from './components'
import { londonStamp, mw, signedMw } from './format'

export function DecisionPage({ day, cutoff }: { day: string; cutoff: string }) {
  const { data, error, isLoading, refetch } = useDecision(day, cutoff)
  const [showBand, setShowBand] = useState(true)
  const [reveal, setReveal] = useState(false)

  if (isLoading) return <Loading label="Loading decision view" />
  if (error || !data) return <ErrorBox error={error ?? new Error('No data')} retry={() => refetch()} />

  const { cards, band, rows } = data
  const chartData = rows.map((r) => ({
    hour: r.hour_local,
    forecast: r.forecast,
    band: r.band_low != null && r.band_high != null ? [r.band_low, r.band_high] : null,
    actual: reveal ? r.actual : null,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          title="Expected wind (daily avg)"
          sub={cards.peak_hour ? `Forecast peak ${mw(cards.peak_value)} MW at ${cards.peak_hour}` : undefined}
        >
          {mw(cards.expected_avg)} MW
        </Card>
        <Card
          title="Plan-for wind (P10 floor)"
          sub={
            band.available
              ? `Band from ${band.history_days} prior days (${band.history_from} to ${band.history_to})`
              : 'No error band for this day'
          }
        >
          {band.available ? (
            <>
              {mw(cards.plan_for_avg)} MW <span className="text-base text-over">{signedMw(cards.plan_for_delta)}</span>
            </>
          ) : (
            <span className="text-slate-400">n/a</span>
          )}
        </Card>
        <Card
          title="Lowest hour"
          sub={
            cards.lowest_band_low != null
              ? `Band ${mw(cards.lowest_band_low)} - ${mw(cards.lowest_band_high)} MW`
              : undefined
          }
        >
          {cards.lowest_hour ? `${cards.lowest_hour}  ${mw(cards.lowest_value)} MW` : '-'}
        </Card>
      </div>

      {!band.available && (
        <div role="note" className="rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-600">
          {band.reason}
        </div>
      )}

      <Panel
        title={`Hourly wind, ${day}`}
        right={
          <div className="flex gap-4">
            <Toggle label="Error band" checked={showBand} onChange={setShowBand} />
            <Toggle label="Reveal actual" checked={reveal} onChange={setReveal} />
          </div>
        }
      >
        <div className="h-80" role="img" aria-label="Hourly forecast with error band; the table below has the same data">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" interval={2} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} />
              <Tooltip formatter={(v) => (Array.isArray(v) ? `${mw(v[0])} - ${mw(v[1])} MW` : `${mw(Number(v))} MW`)} />
              <Legend />
              {showBand && band.available && (
                <Area dataKey="band" name="Error band (P10-P90)" stroke="none" fill="#93c5fd" fillOpacity={0.45} isAnimationActive={false} />
              )}
              <Line dataKey="forecast" name="Forecast" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
              {reveal && (
                <Line dataKey="actual" name="Actual" stroke="#111827" strokeWidth={2} dot={false} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Hourly table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-1 pr-4">Hour</th>
                <th className="pr-4 text-right">Forecast MW</th>
                <th className="pr-4 text-right">Band low</th>
                <th className="pr-4 text-right">Band high</th>
                <th className="pr-4">Vintage (London)</th>
                {reveal && <th className="pr-4 text-right">Actual MW</th>}
                {reveal && <th className="text-right">Error MW</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hour_utc} className="border-b border-slate-100">
                  <td className="py-1 pr-4">{r.hour_local}</td>
                  <td className="pr-4 text-right">{mw(r.forecast)}</td>
                  <td className="pr-4 text-right text-slate-500">{mw(r.band_low)}</td>
                  <td className="pr-4 text-right text-slate-500">{mw(r.band_high)}</td>
                  <td className="pr-4 text-slate-500">{londonStamp(r.vintage)}</td>
                  {reveal && <td className="pr-4 text-right">{mw(r.actual)}</td>}
                  {reveal && (
                    <td className={`text-right ${r.error != null && r.error > 0 ? 'text-over' : 'text-under'}`}>
                      {signedMw(r.error)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
