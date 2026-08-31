import { clampPercent } from '@/features/coaches/boardGeometry'

const DAY_MS = 24 * 60 * 60 * 1000

function toMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime()
}

export function dateToPercent(date: string, minDate: string, maxDate: string): number {
  const min = toMs(minDate)
  const max = toMs(maxDate)
  if (max <= min) return 100
  return clampPercent(((toMs(date) - min) / (max - min)) * 100)
}

export function percentToDate(percent: number, minDate: string, maxDate: string): string {
  const min = toMs(minDate)
  const max = toMs(maxDate)
  if (max <= min) return minDate
  const clamped = clampPercent(percent)
  const ms = min + (clamped / 100) * (max - min)
  const snapped = Math.round(ms / DAY_MS) * DAY_MS
  return new Date(snapped).toISOString().slice(0, 10)
}
