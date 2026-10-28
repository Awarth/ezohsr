import type { ReactNode } from 'react'

const accent = {
  neutral: 'border-l-slate-300',
  brand: 'border-l-forecast',
  over: 'border-l-over',
  under: 'border-l-under',
} as const

export type Tone = keyof typeof accent

export function Card({
  title,
  children,
  sub,
  tone = 'neutral',
}: {
  title: string
  children: ReactNode
  sub?: ReactNode
  tone?: Tone
}) {
  return (
    <div className={`rounded-lg border border-l-4 border-slate-200 ${accent[tone]} bg-white p-4 shadow-sm`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{children}</div>
      {sub && <div className="mt-1 text-xs leading-snug text-slate-500">{sub}</div>}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
      <span className="sr-only">{label}...</span>
    </div>
  )
}

export function ErrorBox({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">Could not load data</p>
      <p className="mt-1">{error.message}</p>
      <button onClick={retry} className="mt-3 rounded border border-red-300 bg-white px-3 py-1 hover:bg-red-100">
        Retry
      </button>
    </div>
  )
}

export function Callout({ tone = 'info', children, action }: { tone?: 'info' | 'warn'; children: ReactNode; action?: ReactNode }) {
  const styles =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-950'
  return (
    <div role="note" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <p className="max-w-3xl leading-relaxed">{children}</p>
      {action}
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'good' | 'bad' | 'neutral'; children: ReactNode }) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    bad: 'bg-slate-100 text-slate-600 ring-slate-200',
    neutral: 'bg-blue-50 text-blue-800 ring-blue-200',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>{children}</span>
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-700"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-forecast' : 'bg-slate-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 ${value === o.value ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SignLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-over" /> Forecast above actual (over-forecast, +)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-under" /> Forecast below actual (-)
      </span>
    </p>
  )
}

export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-800">{title}</div>
      <dl className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-1.5 text-slate-500">
              {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </dt>
            <dd className="font-medium text-slate-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
