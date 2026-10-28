import { mw, shortDay, signedMw } from './format'

interface DayStat {
  day: string
  mae: number | null
  bias: number | null
}

/** One cell per delivery day, shaded by that day's MAE, so the bad days stand out and are one click away. */
export function DayStrip({ days, selected, onSelect }: { days: DayStat[]; selected: string; onSelect: (d: string) => void }) {
  const maxMae = Math.max(1, ...days.map((d) => d.mae ?? 0))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Forecast error by delivery day (darker = larger MAE). Click a day to open it.</span>
        <span className="hidden items-center gap-1.5 sm:flex">
          low
          <span className="h-2 w-16 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.08), rgba(37,99,235,1))' }} />
          high
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(26px, 1fr))` }}>
          {days.map((d) => {
            const t = (d.mae ?? 0) / maxMae
            const alpha = 0.08 + 0.92 * t
            const isSelected = d.day === selected
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => onSelect(d.day)}
                aria-label={`${shortDay(d.day)}, MAE ${mw(d.mae)} MW, bias ${signedMw(d.bias)} MW`}
                aria-current={isSelected ? 'date' : undefined}
                title={`${shortDay(d.day)} - MAE ${mw(d.mae)} MW, bias ${signedMw(d.bias)} MW`}
                className={`h-8 rounded text-[11px] font-medium ${
                  isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : 'hover:ring-2 hover:ring-slate-400'
                } ${alpha > 0.55 ? 'text-white' : 'text-slate-700'}`}
                style={{ background: `rgba(37,99,235,${alpha})` }}
              >
                {Number(d.day.slice(8))}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
