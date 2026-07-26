// Resolución del período sobre el que se calculan las conclusiones del informe.
// La "temporada actual" se detecta por los datos, no por el calendario: se corta
// en el último hueco largo entre partidos del club. Así funciona igual para ligas
// europeas (agosto-mayo) que para las sudamericanas o los torneos cortos de México.

import type { PeriodConfig, ResolvedPeriod, TeamFixture } from './types'

const DAY_MS = 86_400_000
const SEASON_GAP_DAYS = 45

export function toISODate(d: string | Date): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10)
}

/** Primer partido posterior al último hueco de 45+ días. Null si no hay partidos. */
export function seasonStart(fixtures: TeamFixture[]): string | null {
  const sorted = [...fixtures].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  if (sorted.length === 0) return null
  let start = sorted[0].date
  for (let i = 1; i < sorted.length; i++) {
    const gap = +new Date(sorted[i].date) - +new Date(sorted[i - 1].date)
    if (gap >= SEASON_GAP_DAYS * DAY_MS) start = sorted[i].date
  }
  return toISODate(start)
}

export function resolvePeriod(
  config: PeriodConfig,
  ctx: { signingDate: string | null; fixtures: TeamFixture[] },
): ResolvedPeriod {
  const { signingDate, fixtures } = ctx

  if (config.mode === 'custom' && config.from) {
    return { mode: 'custom', from: config.from, to: config.to ?? null, anchorDate: null }
  }

  if (config.mode === 'signing' && signingDate) {
    const from = toISODate(signingDate)
    return { mode: 'signing', from, to: null, anchorDate: from }
  }

  if (config.mode === 'last10') {
    const played = fixtures
      .filter(f => f.score_home != null)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const tenth = played[9] ?? played[played.length - 1]
    if (tenth) return { mode: 'last10', from: toISODate(tenth.date), to: null, anchorDate: null }
  }

  // Default y fallback de todo lo anterior: temporada actual.
  return { mode: 'season', from: seasonStart(fixtures) ?? '1970-01-01', to: null, anchorDate: null }
}

export function inPeriod(dateISO: string, period: ResolvedPeriod): boolean {
  const d = dateISO.slice(0, 10)
  if (d < period.from) return false
  if (period.to && d > period.to) return false
  return true
}
