import type { EnrichedMatchRow } from './components/CoachMatchMetricsEvolution'

export interface SplitStats {
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  ppg: number | null
  winPct: number | null
}

function computeSplit(rows: EnrichedMatchRow[]): SplitStats {
  let won = 0, drawn = 0, lost = 0
  for (const r of rows) {
    if (r.result === 'G') won++
    else if (r.result === 'E') drawn++
    else if (r.result === 'P') lost++
  }
  const played = won + drawn + lost
  const points = won * 3 + drawn
  return {
    played, won, drawn, lost, points,
    ppg: played > 0 ? points / played : null,
    winPct: played > 0 ? (won / played) * 100 : null,
  }
}

/** Rendimiento como local vs. como visitante -- separa los partidos jugados por
 *  el DT segun `isHome` y calcula puntos/partido y % de victorias de cada lado. */
export function computeHomeAwaySplit(rows: EnrichedMatchRow[]): { home: SplitStats; away: SplitStats } {
  const finished = rows.filter(r => r.result !== null)
  return {
    home: computeSplit(finished.filter(r => r.isHome)),
    away: computeSplit(finished.filter(r => !r.isHome)),
  }
}

export interface CumulativePoint {
  date: string
  opponent: string
  points: number
}

/** Puntos acumulados partido a partido (perspectiva propia, orden cronologico) --
 *  la curva de rendimiento del DT a lo largo de la temporada. */
export function buildCumulativePoints(rows: EnrichedMatchRow[]): CumulativePoint[] {
  const finished = [...rows].filter(r => r.result !== null).sort((a, b) => a.date.localeCompare(b.date))
  let total = 0
  return finished.map(r => {
    total += r.result === 'G' ? 3 : r.result === 'E' ? 1 : 0
    return { date: r.date, opponent: r.opponent, points: total }
  })
}
