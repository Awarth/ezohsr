import { useEffect, useState } from 'react'
import { useMeta } from './api'
import { AccuracyPage } from './AccuracyPage'
import { ErrorBox, Loading, Segmented } from './components'
import { DecisionPage } from './DecisionPage'
import { addDays, londonStamp, longDay } from './format'
import { useDecision } from './api'

type Tab = 'decision' | 'accuracy'

export default function App() {
  const meta = useMeta()
  const params = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'accuracy' ? 'accuracy' : 'decision')
  const [day, setDay] = useState(params.get('day') ?? '2026-01-15')
  const [cutoff, setCutoff] = useState(params.get('cutoff') ?? '09:50')
  const [cutoffDraft, setCutoffDraft] = useState(cutoff)

  useEffect(() => {
    history.replaceState(null, '', `?tab=${tab}&day=${day}&cutoff=${cutoff}`)
  }, [tab, day, cutoff])

  useEffect(() => {
    if (!meta.data) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      if (!step) return
      setDay((d) => {
        const next = addDays(d, step)
        return next < meta.data.first_day || next > meta.data.last_day ? d : next
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meta.data])

  // Shares the cached decision query so the header's vintage line is always the data shown below.
  const decision = useDecision(day, cutoff)

  if (meta.isLoading) return <Loading />
  if (meta.error || !meta.data) return <ErrorBox error={meta.error ?? new Error('No data')} retry={() => meta.refetch()} />
  const m = meta.data
  const validCutoff = /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoffDraft)

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Wind Forecast Desk</h1>
            <p className="text-xs text-slate-500">GB national wind - Elexon FUELHH and WINDFOR - January 2026 decisions</p>
          </div>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'decision', label: 'Decision' },
              { value: 'accuracy', label: 'Accuracy' },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Delivery day</span>
            <button
              aria-label="Previous day"
              disabled={day <= m.first_day}
              onClick={() => setDay(addDays(day, -1))}
              className="rounded border border-slate-300 px-2 disabled:opacity-30"
            >
              &lt;
            </button>
            <input
              type="date"
              aria-label="Delivery day"
              value={day}
              min={m.first_day}
              max={m.last_day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="rounded border border-slate-300 px-2 py-0.5"
            />
            <button
              aria-label="Next day"
              disabled={day >= m.last_day}
              onClick={() => setDay(addDays(day, 1))}
              className="rounded border border-slate-300 px-2 disabled:opacity-30"
            >
              &gt;
            </button>
            <span className="text-slate-700">{longDay(day)}</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="cutoff" className="text-slate-500">
              Decision cutoff (D-1, London)
            </label>
            <input
              id="cutoff"
              value={cutoffDraft}
              onChange={(e) => {
                setCutoffDraft(e.target.value)
                if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) setCutoff(e.target.value)
              }}
              aria-invalid={!validCutoff}
              className={`w-16 rounded border px-2 py-0.5 ${validCutoff ? 'border-slate-300' : 'border-red-400'}`}
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600" data-testid="vintage-line">
          {decision.data?.vintage ? (
            <>
              Forecast vintage: published <strong>{londonStamp(decision.data.vintage)}</strong>
              {decision.data.vintage_minutes_before_cutoff != null &&
                ` - ${decision.data.vintage_minutes_before_cutoff} min before cutoff`}
            </>
          ) : decision.isLoading ? (
            'Selecting forecast vintage...'
          ) : (
            'No forecast was available at this cutoff'
          )}
        </p>
      </header>

      {tab === 'decision' ? <DecisionPage day={day} cutoff={cutoff} /> : <AccuracyPage day={day} cutoff={cutoff} onOpenDay={(d) => { setDay(d); setTab('decision') }} />}
    </div>
  )
}
