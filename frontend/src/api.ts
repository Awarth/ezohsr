import { useQuery } from '@tanstack/react-query'

export interface Meta {
  first_day: string
  last_day: string
  default_cutoff: string
  built_at: string
  band_window_days: number
  band_min_days: number
}

export interface Metrics {
  n: number
  mae: number
  rmse: number
  bias: number
  p10: number
  p50: number
  p90: number
  p90_abs: number
}

export interface Band {
  available: boolean
  reason: string | null
  history_days: number
  history_from: string | null
  history_to: string | null
  err_low: number | null
  err_high: number | null
}

export interface DecisionRow {
  hour_utc: string
  hour_local: string
  forecast: number | null
  vintage: string | null
  band_low: number | null
  band_high: number | null
  actual: number | null
  error: number | null
}

export interface DecisionResponse {
  day: string
  cutoff: string
  cutoff_at: string
  vintage: string | null
  vintage_minutes_before_cutoff: number | null
  band: Band
  cards: {
    expected_avg: number | null
    plan_for_avg: number | null
    plan_for_delta: number | null
    peak_hour: string | null
    peak_value: number | null
    lowest_hour: string | null
    lowest_value: number | null
    lowest_band_low: number | null
    lowest_band_high: number | null
  }
  rows: DecisionRow[]
}

export interface AccuracyResponse {
  scope: 'month' | 'day'
  day: string | null
  cutoff: string
  metrics: Metrics | null
  quality: {
    expected_hours: number
    matched_hours: number
    missing: { hour: string; has_forecast: boolean; has_actual: boolean }[]
  }
  daily: { day: string; mae: number | null; bias: number | null; n: number }[]
  by_hour: { hour: number; n: number; bias: number; p10: number; p90: number; mae: number }[]
  sample_note: string
}

export interface VintageResult {
  label: string
  status: 'usable' | 'after cutoff'
  metrics: Metrics | null
}

async function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ? String(detail.detail) : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => getJson<Meta>('meta') })

export const useDecision = (day: string, cutoff: string) =>
  useQuery({ queryKey: ['decision', day, cutoff], queryFn: () => getJson<DecisionResponse>('decision', { day, cutoff }) })

export const useAccuracy = (scope: 'month' | 'day', day: string, cutoff: string) =>
  useQuery({
    queryKey: ['accuracy', scope, scope === 'day' ? day : '', cutoff],
    queryFn: () => getJson<AccuracyResponse>('accuracy', scope === 'day' ? { scope, day, cutoff } : { scope, cutoff }),
  })

export const useVintages = (cutoff: string) =>
  useQuery({ queryKey: ['vintages', cutoff], queryFn: () => getJson<VintageResult[]>('vintages', { cutoff }) })
