import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DecisionRow } from './api'
import { useDecision } from './api'
import { Callout, Card, ErrorBox, Loading, Panel, SignLegend, Toggle, TooltipBox } from './components'
import { longDay, londonStamp, mw, signedMw } from './format'

type ChartRow = {
  hour: string
  forecast: number | null
  band: [number, number] | null
  actual: number | null
  vintage: string | null
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  const rows = [{ label: 'Forecast', value: `${mw(r.forecast)} MW`, color: '#2563eb' }]
  if (r.band) rows.push({ label: 'Band (P10-P90)', value: `${mw(r.band[0])} - ${mw(r.band[1])} MW`, color: '#93c5fd' })
  if (r.actual != null) rows.push({ label: 'Actual', value: `${mw(r.actual)} MW`, color: '#111827' })
  rows.push({ label: 'Vintage', value: londonStamp(r.vintage), color: '' })
  return <TooltipBox title={`${r.hour} London`} rows={rows} />
}

function revealSummary(rows: DecisionRow[]) {
  const scored = rows.filter((r) => r.actual != null && r.error != null)
  if (!scored.length) return null
  const bias = scored.reduce((s, r) => s + (r.error as number), 0) / scored.length
  const mae = scored.reduce((s, r) => s + Math.abs(r.error as number), 0) / scored.length
  const banded = scored.filter((r) => r.band_low != null && r.band_high != null)
  const inside = banded.filter((r) => (r.actual as number) >= (r.band_low as number) && (r.actual as number) <= (r.band_high as number)).length
  return { n: scored.length, bias, mae, inside, banded: banded.length }
}

export function DecisionPage({ day, cutoff }: { day: string; cutoff: string }) {
  const { data, error, isLoading, refetch } = useDecision(day, cutoff)
  const [showBand, setShowBand] = useState(true)
  const [reveal, setReveal] = useState(false)

  if (isLoading) return <Loading label="Loading decision view" />
  if (error || !data) return <ErrorBox error={error ?? new Error('No data')} retry={() => refetch()} />

  const { cards, band, rows } = data
  const chartData: ChartRow[] = rows.map((r) => ({
    hour: r.hour_local,
    forecast: r.forecast,
    band: r.band_low != null && r.band_high != null ? [r.band_low, r.band_high] : null,
    actual: reveal ? r.actual : null,
    vintage: r.vintage,
  }))
  const summary = reveal ? revealSummary(rows) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          tone="brand"
          title="Expected wind (daily avg)"
          sub={cards.peak_hour ? `Forecast peak ${mw(cards.peak_value)} MW at ${cards.peak_hour}` : undefined}
        >
          {mw(cards.expected_avg)} MW
        </Card>
        <Card
          tone="over"
          title="Plan-for wind (P10 floor)"
          sub={
            band.available
              ? `Wind uncertainty only, not a purchase volume. Band from ${band.history_days} prior days (${band.history_from} to ${band.history_to}).`
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

      {band.available && cards.plan_for_delta != null && (
        <Callout>
          For <strong>{longDay(day)}</strong>, plan for about <strong>{mw(cards.plan_for_avg)} MW</strong> of wind on average, not the{' '}
          {mw(cards.expected_avg)} MW forecast: errors over the prior {band.history_days} days put the P10 floor{' '}
          {mw(Math.abs(cards.plan_for_delta))} MW {cards.plan_for_delta < 0 ? 'below' : 'above'} the forecast.
        </Callout>
      )}

      {!band.available && <Callout tone="warn">{band.reason}</Callout>}

      <Panel
        title={`Hourly wind, ${longDay(day)}`}
        subtitle="Hover a point for the hour, band and the forecast vintage used."
        right={
          <div className="flex gap-5">
            <Toggle label="Error band" checked={showBand} onChange={setShowBand} />
            <Toggle label="Reveal actual" checked={reveal} onChange={setReveal} />
          </div>
        }
      >
        <div className="h-80" role="img" aria-label="Hourly forecast with error band; the table below has the same data">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" interval={2} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tick={{ fontSize: 12 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#64748b' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {showBand && band.available && (
                <Area dataKey="band" name="Error band (P10-P90)" stroke="none" fill="#93c5fd" fillOpacity={0.45} isAnimationActive={false} />
              )}
              <Line dataKey="forecast" name="Forecast" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
              {reveal && (
                <Line dataKey="actual" name="Actual" stroke="#111827" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {summary && (
        <Callout>
          With the actuals revealed, the forecast {summary.bias > 0 ? 'over-forecast' : 'under-forecast'} by{' '}
          <strong>{mw(Math.abs(summary.bias))} MW</strong> on average (MAE {mw(summary.mae)} MW over {summary.n} hours)
          {summary.banded > 0 && (
            <>
              ; the actual landed inside the error band in <strong>{summary.inside} of {summary.banded}</strong> hours
            </>
          )}
          .
        </Callout>
      )}

      <Panel title="Hourly table" right={reveal ? <SignLegend /> : undefined}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5 pr-4">Hour</th>
                <th className="pr-4 text-right">Forecast MW</th>
                <th className="pr-4 text-right">Band low</th>
                <th className="pr-4 text-right">Band high</th>
                <th className="pr-4">Vintage (London)</th>
                {reveal && <th className="pr-4 text-right">Actual MW</th>}
                {reveal && <th className="text-right">Error MW</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const outside =
                  reveal && r.actual != null && r.band_low != null && r.band_high != null && (r.actual < r.band_low || r.actual > r.band_high)
                return (
                  <tr key={r.hour_utc} className={`border-b border-slate-100 hover:bg-slate-50 ${outside ? 'bg-red-50/60' : ''}`}>
                    <td className="py-1.5 pr-4 font-medium">{r.hour_local}</td>
                    <td className="pr-4 text-right">{mw(r.forecast)}</td>
                    <td className="pr-4 text-right text-slate-500">{mw(r.band_low)}</td>
                    <td className="pr-4 text-right text-slate-500">{mw(r.band_high)}</td>
                    <td className="pr-4 text-slate-500">{londonStamp(r.vintage)}</td>
                    {reveal && <td className="pr-4 text-right">{mw(r.actual)}</td>}
                    {reveal && (
                      <td className={`text-right font-medium ${r.error != null && r.error > 0 ? 'text-over' : 'text-under'}`}>
                        {signedMw(r.error)}
                        {outside && <span className="ml-1 text-[10px] font-normal uppercase text-slate-500">outside band</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
