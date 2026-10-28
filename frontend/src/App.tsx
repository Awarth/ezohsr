import { useEffect, useState } from 'react'
import { useAccuracy, useDecision, useMeta } from './api'
import { AccuracyPage } from './AccuracyPage'
import { Badge, ErrorBox, Loading, Spinner, TopProgress } from './components'
import { DayStrip } from './DayStrip'
import { DecisionPage } from './DecisionPage'
import { addDays, londonStamp, longDay } from './format'

type Tab = 'decision' | 'accuracy'

const CUTOFF_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const stepBtn =
  'flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white'

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

  // Both share cached queries with the pages below, so the header never disagrees with the data shown.
  const decision = useDecision(day, cutoff)
  const month = useAccuracy('month', day, cutoff)

  if (meta.isLoading)
    return (
      <div className="mx-auto max-w-6xl p-4">
        <TopProgress />
        <Loading label="Loading Wind Forecast Desk" />
      </div>
    )
  if (meta.error || !meta.data) return <ErrorBox error={meta.error ?? new Error('No data')} retry={() => meta.refetch()} />
  const m = meta.data
  const validCutoff = CUTOFF_RE.test(cutoffDraft)
  const d = decision.data

  const tabs: { value: Tab; label: string }[] = [
    { value: 'decision', label: 'Decision' },
    { value: 'accuracy', label: 'Accuracy' },
  ]

  return (
    <div className="min-h-screen">
      <TopProgress />
      <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur md:sticky md:top-0 md:z-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pt-3">
            <div className="pb-2">
              <h1 className="text-lg font-semibold tracking-tight">Wind Forecast Desk</h1>
              <p className="text-xs text-slate-500">GB national wind &middot; Elexon FUELHH and WINDFOR &middot; January 2026 decisions</p>
            </div>
            <nav role="tablist" aria-label="View" className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                    tab === t.value ? 'border-forecast text-forecast' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery day</span>
              <button aria-label="Previous day" disabled={day <= m.first_day} onClick={() => setDay(addDays(day, -1))} className={stepBtn}>
                &lsaquo;
              </button>
              <input
                type="date"
                aria-label="Delivery day"
                value={day}
                min={m.first_day}
                max={m.last_day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2"
              />
              <button aria-label="Next day" disabled={day >= m.last_day} onClick={() => setDay(addDays(day, 1))} className={stepBtn}>
                &rsaquo;
              </button>
              <span className="hidden font-medium text-slate-800 sm:inline">{longDay(day)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="cutoff" className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Decision cutoff (D-1, London)
              </label>
              <input
                id="cutoff"
                inputMode="numeric"
                placeholder="09:50"
                value={cutoffDraft}
                onChange={(e) => {
                  setCutoffDraft(e.target.value)
                  if (CUTOFF_RE.test(e.target.value)) setCutoff(e.target.value)
                }}
                aria-invalid={!validCutoff}
                aria-describedby="cutoff-hint"
                className={`h-8 w-20 rounded-md border bg-white px-2 text-center ${validCutoff ? 'border-slate-300' : 'border-red-400 bg-red-50'}`}
              />
              <span id="cutoff-hint" className={`text-xs ${validCutoff ? 'sr-only' : 'text-red-600'}`}>
                Use 24-hour HH:MM
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-slate-600" data-testid="vintage-line">
              {d?.vintage ? (
                <>
                  <span>
                    Forecast vintage: published <strong className="text-slate-900">{londonStamp(d.vintage)}</strong>
                  </span>
                  {d.vintage_minutes_before_cutoff != null && <Badge tone="neutral">{d.vintage_minutes_before_cutoff} min before cutoff</Badge>}
                </>
              ) : decision.isLoading ? (
                <span className="flex items-center gap-2 text-slate-500">
                  <Spinner /> Selecting forecast vintage...
                </span>
              ) : (
                'No forecast was available at this cutoff'
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {month.data ? (
            <DayStrip days={month.data.daily} selected={day} onSelect={setDay} />
          ) : (
            <div role="status" aria-label="Loading day strip" className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner /> Loading forecast error by day...
              </div>
              <div className="h-8 animate-pulse rounded bg-slate-200/70" />
            </div>
          )}
        </div>
      </div>
      <main className="mx-auto max-w-6xl p-4">
        {tab === 'decision' ? (
          <DecisionPage day={day} cutoff={cutoff} />
        ) : (
          <AccuracyPage
            day={day}
            cutoff={cutoff}
            onOpenDay={(x) => {
              setDay(x)
              setTab('decision')
            }}
          />
        )}
      </main>
    </div>
  )
}
