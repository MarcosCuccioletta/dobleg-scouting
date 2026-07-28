import type { PlayerMatchStat } from '@/types/scoring'

export interface CurrentClub {
  teamId: number | null
  teamName: string | null
  leagueId: number | null
}

/**
 * Club actual del jugador según el último partido que jugó.
 *
 * Es la única fuente con evidencia detrás: el club del CSV lo carga la agencia a
 * mano y se desactualiza, y `players.current_team_id` queda viejo cuando la liga
 * deja de sincronizar. Tomando el último partido, el club y la liga salen siempre
 * del mismo hecho, así que nunca se muestra un club de un país con la liga de otro.
 *
 * Devuelve null si el jugador no tiene partidos con fecha.
 */
export function currentClubFromMatches(matches: PlayerMatchStat[]): CurrentClub | null {
  let last: PlayerMatchStat | null = null
  let lastTime = -Infinity

  for (const m of matches) {
    const date = m.fixture?.date
    if (!date) continue
    const t = new Date(date).getTime()
    if (Number.isNaN(t) || t < lastTime) continue
    lastTime = t
    last = m
  }

  if (!last?.fixture) return null

  const f = last.fixture
  const isHome = last.team_id === f.home_team_id
  const name = isHome ? f.home_team?.name : f.away_team?.name

  return {
    teamId: last.team_id ?? null,
    teamName: name ?? null,
    leagueId: f.league_id ?? null,
  }
}
