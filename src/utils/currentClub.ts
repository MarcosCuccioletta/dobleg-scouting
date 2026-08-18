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

/**
 * Nombre de club a mostrar, combinando el último partido con el dato curado de
 * la agencia (`agencyPlayers.ts`, actualizado a mano + sync de Transfermarkt).
 *
 * Para los ~40 jugadores de Doble G, ese roster es más confiable que el último
 * partido sincronizado cuando ambos discrepan: un traspaso recién cargado no
 * tiene partidos todavía en la liga nueva, así que "el último partido" sigue
 * apuntando al club anterior hasta que esa liga sincronice — lo que puede
 * tardar meses (caso real: Mauricio Vera a Bhayangkara FC, Indonesia Super
 * League sin sincronizar). Fuera de la agencia (sin `apiTeamId` conocido) no
 * hay con qué comparar, así que se sigue confiando en el último partido —
 * ver el comentario de `currentClubFromMatches` para por qué esa sigue siendo
 * la fuente por defecto.
 */
export function resolveDisplayClub(
  matchClub: CurrentClub | null,
  agencyTeam: { team: string; apiTeamId: number | null } | null,
): string | null {
  if (agencyTeam?.apiTeamId && agencyTeam.apiTeamId !== matchClub?.teamId) {
    return agencyTeam.team
  }
  return matchClub?.teamName ?? agencyTeam?.team ?? null
}
