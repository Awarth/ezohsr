const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export const mw = (v: number | null | undefined) => (v == null ? '-' : nf.format(Math.round(v)))

export const signedMw = (v: number | null | undefined) =>
  v == null ? '-' : `${v > 0 ? '+' : v < 0 ? '-' : ''}${nf.format(Math.abs(Math.round(v)))}`

const londonDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const londonStamp = (iso: string | null) => (iso ? londonDateTime.format(new Date(iso)).replace(',', '') : '-')

export const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
