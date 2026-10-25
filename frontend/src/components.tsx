import type { ReactNode } from 'react'

export function Card({ title, children, sub }: { title: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{children}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="animate-pulse rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-400">
      {label}...
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

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
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
    <div className="inline-flex overflow-hidden rounded border border-slate-300 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1 ${value === o.value ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
