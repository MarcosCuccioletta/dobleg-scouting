// Orquesta los datos de la pestaña Impacto: resuelve el equipo y la fecha de
// llegada, trae partidos del jugador, fixtures del club y filas del plantel, y
// delega todo el cálculo en el módulo puro insights/.

import { useEffect, useMemo, useState } from 'react'
import {
  fetchPlayerAllMatches,
  fetchSquadMatchStats,
  fetchTeamFixtures,
  type SquadStatRow,
} from '@/services/playerStatsService'
import { usePlayerInjuries, usePlayerTransfers } from '@/hooks/usePlayerApiData'
import { usePreferredPlayerId } from '@/hooks/usePlayerStats'
import type { PlayerMatchStat } from '@/types/scoring'
import { computeInsights } from './insights/compute'
import { resolvePeriod, toISODate } from './insights/period'
import { aggregateSquad, defaultMinMinutes } from './insights/squad'
import {
  BLOCK_IDS,
  type InsightsConfig,
  type InsightsResult,
  type PlayerMatchRow,
  type SquadMatchRow,
  type TeamFixture,
} from './insights/types'
import type { Informe } from './types'

export const DEFAULT_INSIGHTS_CONFIG: InsightsConfig = {
  enabled: false,
  period: { mode: 'signing' },
  blocks: [...BLOCK_IDS],
  hiddenItems: [],
  overrides: {},
}

export interface InformeInsights {
  result: InsightsResult | null
  loading: boolean
  teamId: number | null
  signingDate: string | null
  squadLeaderMinutes: number
  defaultMinutes: number
}

const EMPTY: InformeInsights = {
  result: null, loading: false, teamId: null, signingDate: null, squadLeaderMinutes: 0, defaultMinutes: 0,
}

function toPlayerRows(matches: PlayerMatchStat[], teamId: number): PlayerMatchRow[] {
  return matches
    .filter(m => m.team_id === teamId && m.fixture?.date)
    .map(m => ({
      player_id: m.player_id,
      player_name: '',
      fixture_id: m.fixture_id,
      date: m.fixture!.date,
      minutes: m.minutes ?? 0,
      goals: m.goals ?? 0,
      assists: m.assists ?? 0,
      passes_key: m.passes_key ?? 0,
      duels_won: m.duels_won ?? 0,
      duels_total: m.duels_total ?? 0,
      dribbles_success: m.dribbles_success ?? 0,
      dribbles_attempted: m.dribbles_attempted ?? 0,
      rating: m.rating,
      detected_position: m.detected_position,
      is_substitute: m.is_substitute,
      team_id: m.team_id,
      home_team_id: m.fixture!.home_team_id,
      away_team_id: m.fixture!.away_team_id,
      score_home: m.fixture!.score_home,
      score_away: m.fixture!.score_away,
    }))
}

function toSquadRows(rows: SquadStatRow[]): SquadMatchRow[] {
  return rows
    .filter(r => r.fixture?.date)
    .map(r => ({
      player_id: r.player_id,
      player_name: r.player?.name ?? `#${r.player_id}`,
      fixture_id: r.fixture_id,
      date: r.fixture!.date,
      minutes: r.minutes ?? 0,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      passes_key: r.passes_key ?? 0,
      duels_won: r.duels_won ?? 0,
      duels_total: r.duels_total ?? 0,
      dribbles_success: r.dribbles_success ?? 0,
      dribbles_attempted: r.dribbles_attempted ?? 0,
      rating: r.rating,
      detected_position: r.detected_position,
    }))
}

export function useInformeInsights(informe: Informe | null): InformeInsights {
  // Si el informe quedó linkeado al duplicado de Sofascore, se lee el de API-Football.
  const playerId = usePreferredPlayerId(informe?.dbPlayerId ?? null)
  const config = informe?.insights ?? DEFAULT_INSIGHTS_CONFIG

  const [matches, setMatches] = useState<PlayerMatchStat[]>([])
  const [fixtures, setFixtures] = useState<TeamFixture[]>([])
  const [squadRows, setSquadRows] = useState<SquadMatchRow[]>([])
  const [loading, setLoading] = useState(false)

  const { transfers } = usePlayerTransfers(playerId)
  const { injuries } = usePlayerInjuries(playerId)

  // 1) Partidos del jugador: definen el club actual.
  useEffect(() => {
    if (!playerId) { setMatches([]); return }
    let cancelled = false
    setLoading(true)
    fetchPlayerAllMatches(playerId)
      .then(rows => { if (!cancelled) setMatches(rows) })
      .catch(() => { if (!cancelled) setMatches([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const teamId = useMemo(() => {
    const withDate = matches.filter(m => m.fixture?.date)
    if (withDate.length === 0) return null
    return withDate[withDate.length - 1].team_id
  }, [matches])

  // Fecha de llegada: último traspaso hacia el club; si no hay, su primer partido.
  const signingDate = useMemo(() => {
    if (!teamId) return null
    const toTeam = transfers
      .filter(tr => tr.teams?.in?.id === teamId && tr.date)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]
    if (toTeam?.date) return toISODate(toTeam.date)
    const own = matches.filter(m => m.team_id === teamId && m.fixture?.date)
    return own.length ? toISODate(own[0].fixture!.date) : null
  }, [teamId, transfers, matches])

  // 2) Fixtures del club + plantel, desde el inicio de todo lo que pueda pedirse.
  const fetchFrom = useMemo(() => {
    const candidates = [signingDate, ...matches.filter(m => m.fixture?.date).map(m => toISODate(m.fixture!.date))]
      .filter((d): d is string => !!d)
    return candidates.length ? candidates.sort()[0] : null
  }, [signingDate, matches])

  useEffect(() => {
    if (!teamId || !fetchFrom) { setFixtures([]); setSquadRows([]); return }
    let cancelled = false
    setLoading(true)
    Promise.all([fetchTeamFixtures(teamId, fetchFrom), fetchSquadMatchStats(teamId, fetchFrom)])
      .then(([fx, squad]) => {
        if (cancelled) return
        setFixtures(fx)
        setSquadRows(toSquadRows(squad))
      })
      .catch(() => {
        if (cancelled) return
        setFixtures([])
        setSquadRows([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId, fetchFrom])

  return useMemo<InformeInsights>(() => {
    if (!informe || !playerId || !teamId) return { ...EMPTY, loading }

    const period = resolvePeriod(config.period, { signingDate, fixtures })
    const squadInPeriod = aggregateSquad(squadRows.filter(r => r.date.slice(0, 10) >= period.from))
    const leaderMinutes = squadInPeriod.reduce((max, s) => Math.max(max, s.minutes), 0)
    const fallbackMinutes = defaultMinMinutes(squadInPeriod)

    const result = computeInsights({
      playerId,
      teamId,
      period,
      playerMatches: toPlayerRows(matches, teamId),
      squadRows,
      fixtures,
      injuries: injuries.map(i => ({ type: i.type, start: i.start, end: i.end })),
      blocks: config.blocks,
      minMinutes: config.minMinutes,
      overrides: { teamMatches: config.teamMatchesOverride, teamGoals: config.teamGoalsOverride },
      percentile: informe.dbPercentile ?? null,
    })

    return { result, loading, teamId, signingDate, squadLeaderMinutes: leaderMinutes, defaultMinutes: fallbackMinutes }
  }, [informe, playerId, teamId, config, matches, fixtures, squadRows, injuries, signingDate, loading])
}
