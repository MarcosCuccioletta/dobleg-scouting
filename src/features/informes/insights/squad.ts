// Agregación del plantel y rankings internos. La regla que define si esto es serio
// o ridículo está acá: las métricas de eficacia (promedios y porcentajes) sólo
// rankean entre jugadores que superan un umbral de minutos; las acumuladas rankean
// contra todos, porque el volumen ya está adentro del número.

import type { SquadMatchRow } from './types'

export interface SquadAgg {
  playerId: number
  name: string
  matches: number
  minutes: number
  goals: number
  assists: number
  ga: number
  keyPasses: number
  duelsWon: number
  duelsTotal: number
  duelPct: number | null
  dribblesSuccess: number
  dribblesAttempted: number
  dribblePct: number | null
  scoreAvg: number | null
  position: string | null
  isKeeper: boolean
}

export type CumulativeMetric = 'goals' | 'assists' | 'ga' | 'keyPasses' | 'minutes'
export type RateMetric = 'duelPct' | 'dribblePct' | 'scoreAvg'
export type RankMetric = CumulativeMetric | RateMetric

export const CUMULATIVE_METRICS: CumulativeMetric[] = ['goals', 'assists', 'ga', 'keyPasses', 'minutes']
export const RATE_METRICS: RateMetric[] = ['duelPct', 'dribblePct', 'scoreAvg']

export interface RankResult {
  metric: RankMetric
  rank: number
  poolSize: number
  value: number
  teamTotal: number | null   // null en métricas de eficacia: sumarlas no significa nada
  sharePct: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

function pct(part: number, total: number): number | null {
  return total > 0 ? round1((part / total) * 100) : null
}

interface Acc {
  playerId: number
  name: string
  matches: number
  minutes: number
  goals: number
  assists: number
  keyPasses: number
  duelsWon: number
  duelsTotal: number
  dribblesSuccess: number
  dribblesAttempted: number
  scoreSum: number
  scoreCount: number
  positions: Record<string, number>
}

export function aggregateSquad(rows: SquadMatchRow[]): SquadAgg[] {
  const by = new Map<number, Acc>()

  for (const r of rows) {
    const cur: Acc = by.get(r.player_id) ?? {
      playerId: r.player_id,
      name: r.player_name,
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      keyPasses: 0,
      duelsWon: 0,
      duelsTotal: 0,
      dribblesSuccess: 0,
      dribblesAttempted: 0,
      scoreSum: 0,
      scoreCount: 0,
      positions: {},
    }
    if (r.minutes > 0) cur.matches++
    cur.minutes += r.minutes || 0
    cur.goals += r.goals || 0
    cur.assists += r.assists || 0
    cur.keyPasses += r.passes_key || 0
    cur.duelsWon += r.duels_won || 0
    cur.duelsTotal += r.duels_total || 0
    cur.dribblesSuccess += r.dribbles_success || 0
    cur.dribblesAttempted += r.dribbles_attempted || 0
    if (r.match_score != null) {
      cur.scoreSum += r.match_score
      cur.scoreCount++
    }
    if (r.detected_position) cur.positions[r.detected_position] = (cur.positions[r.detected_position] ?? 0) + 1
    by.set(r.player_id, cur)
  }

  return Array.from(by.values()).map(a => {
    const position = Object.entries(a.positions).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    return {
      playerId: a.playerId,
      name: a.name,
      matches: a.matches,
      minutes: a.minutes,
      goals: a.goals,
      assists: a.assists,
      ga: a.goals + a.assists,
      keyPasses: a.keyPasses,
      duelsWon: a.duelsWon,
      duelsTotal: a.duelsTotal,
      duelPct: pct(a.duelsWon, a.duelsTotal),
      dribblesSuccess: a.dribblesSuccess,
      dribblesAttempted: a.dribblesAttempted,
      dribblePct: pct(a.dribblesSuccess, a.dribblesAttempted),
      scoreAvg: a.scoreCount ? round1(a.scoreSum / a.scoreCount) : null,
      position,
      isKeeper: position === 'ARQ',
    }
  })
}

/** 400 minutos, o el 40% del jugador más usado si es menor. Redondeado a 45. */
export function defaultMinMinutes(squad: SquadAgg[]): number {
  const leader = squad.reduce((max, s) => Math.max(max, s.minutes), 0)
  const fortyPct = Math.round((leader * 0.4) / 45) * 45
  return Math.max(0, Math.min(400, fortyPct))
}

function valueOf(s: SquadAgg, metric: RankMetric): number | null {
  switch (metric) {
    case 'goals': return s.goals
    case 'assists': return s.assists
    case 'ga': return s.ga
    case 'keyPasses': return s.keyPasses
    case 'minutes': return s.minutes
    case 'duelPct': return s.duelPct
    case 'dribblePct': return s.dribblePct
    case 'scoreAvg': return s.scoreAvg
  }
}

export function rankInSquad(
  squad: SquadAgg[],
  playerId: number,
  metric: RankMetric,
  opts: { minMinutes: number },
): RankResult | null {
  const me = squad.find(s => s.playerId === playerId)
  if (!me) return null

  const value = valueOf(me, metric)
  if (value == null) return null

  const isRate = (RATE_METRICS as string[]).includes(metric)
  if (isRate && me.minutes < opts.minMinutes) return null

  const pool = squad.filter(s => {
    if (s.playerId === playerId) return true
    if (s.isKeeper && !me.isKeeper) return false
    if (isRate && s.minutes < opts.minMinutes) return false
    return valueOf(s, metric) != null
  })

  const values = pool.map(s => valueOf(s, metric)).filter((v): v is number => v != null)
  const rank = values.filter(v => v > value).length + 1
  const teamTotal = isRate ? null : squad.reduce((sum, s) => sum + (valueOf(s, metric) ?? 0), 0)

  return {
    metric,
    rank,
    poolSize: values.length,
    value,
    teamTotal,
    sharePct: teamTotal != null ? pct(value, teamTotal) : null,
  }
}

/** Un 12º puesto con el 2% del total no es una conclusión: es relleno. */
export function isRankNoteworthy(r: RankResult): boolean {
  return r.rank <= 5 || (r.sharePct ?? 0) >= 10
}
