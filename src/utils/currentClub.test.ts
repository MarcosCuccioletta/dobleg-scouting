import { describe, it, expect } from 'vitest'
import { currentClubFromMatches, resolveDisplayClub } from './currentClub'
import type { PlayerMatchStat } from '@/types/scoring'

function match(opts: {
  teamId: number
  date: string | null
  homeId: number
  awayId: number
  homeName: string
  awayName: string
  leagueId?: number
}): PlayerMatchStat {
  return {
    team_id: opts.teamId,
    fixture: opts.date
      ? {
          id: 1,
          date: opts.date,
          home_team_id: opts.homeId,
          away_team_id: opts.awayId,
          score_home: null,
          score_away: null,
          league_id: opts.leagueId ?? 128,
          home_team: { name: opts.homeName },
          away_team: { name: opts.awayName },
        }
      : undefined,
  } as unknown as PlayerMatchStat
}

const gimnasiaVsTigre = match({
  teamId: 434, date: '2026-04-05T18:30:00+00:00',
  homeId: 434, awayId: 452, homeName: 'Gimnasia L.P.', awayName: 'Tigre',
})
const estudiantesVsTigre = match({
  teamId: 2424, date: '2026-07-25T17:45:00+00:00',
  homeId: 2424, awayId: 452, homeName: 'Estudiantes de Rio Cuarto', awayName: 'Tigre',
})

describe('currentClubFromMatches', () => {
  it('devuelve el club del último partido, no el del primero', () => {
    const club = currentClubFromMatches([gimnasiaVsTigre, estudiantesVsTigre])
    expect(club?.teamName).toBe('Estudiantes de Rio Cuarto')
    expect(club?.teamId).toBe(2424)
  })

  it('no depende del orden del array', () => {
    const club = currentClubFromMatches([estudiantesVsTigre, gimnasiaVsTigre])
    expect(club?.teamName).toBe('Estudiantes de Rio Cuarto')
  })

  it('toma el nombre del visitante cuando el jugador jugó de visitante', () => {
    const club = currentClubFromMatches([
      match({
        teamId: 452, date: '2026-07-25T17:45:00+00:00',
        homeId: 2424, awayId: 452, homeName: 'Estudiantes de Rio Cuarto', awayName: 'Tigre',
      }),
    ])
    expect(club?.teamName).toBe('Tigre')
  })

  it('la liga sale del mismo partido que el club', () => {
    const club = currentClubFromMatches([
      match({
        teamId: 20003234, date: '2026-05-10T00:00:00+00:00',
        homeId: 20003234, awayId: 9, homeName: 'Deportivo Maldonado', awayName: 'Peñarol',
        leagueId: 268,
      }),
    ])
    expect(club?.teamName).toBe('Deportivo Maldonado')
    expect(club?.leagueId).toBe(268)
  })

  it('ignora partidos sin fecha', () => {
    const club = currentClubFromMatches([
      match({ teamId: 999, date: null, homeId: 999, awayId: 1, homeName: 'X', awayName: 'Y' }),
      gimnasiaVsTigre,
    ])
    expect(club?.teamName).toBe('Gimnasia L.P.')
  })

  it('devuelve null sin partidos utilizables', () => {
    expect(currentClubFromMatches([])).toBeNull()
    expect(currentClubFromMatches([
      match({ teamId: 1, date: null, homeId: 1, awayId: 2, homeName: 'X', awayName: 'Y' }),
    ])).toBeNull()
  })
})

describe('resolveDisplayClub', () => {
  it('sin dato de agencia, usa el club del último partido tal cual', () => {
    const matchClub = { teamId: 2424, teamName: 'Estudiantes de Rio Cuarto', leagueId: 128 }
    expect(resolveDisplayClub(matchClub, null)).toBe('Estudiantes de Rio Cuarto')
  })

  it('si el equipo de la agencia coincide con el del último partido, no cambia nada', () => {
    const matchClub = { teamId: 2443, teamName: 'Bhayangkara FC', leagueId: 274 }
    const agencyTeam = { team: 'Bhayangkara FC', apiTeamId: 2443 }
    expect(resolveDisplayClub(matchClub, agencyTeam)).toBe('Bhayangkara FC')
  })

  it('si el equipo de la agencia difiere del último partido, gana la agencia (caso real Mauricio Vera)', () => {
    // El último partido sincronizado de Vera sigue siendo con Nacional (Uruguay) porque
    // la Indonesia Super League, donde jugará con Bhayangkara FC, todavía no sincronizó
    // ningún partido — puede tardar meses. Mientras tanto, el dato de la agencia
    // (agencyPlayers.ts, actualizado a mano + sync de Transfermarkt) es más confiable.
    const matchClub = { teamId: 9, teamName: 'Club Nacional', leagueId: 268 }
    const agencyTeam = { team: 'Bhayangkara FC', apiTeamId: 2443 }
    expect(resolveDisplayClub(matchClub, agencyTeam)).toBe('Bhayangkara FC')
  })

  it('sin partidos (matchClub null), usa el equipo de la agencia si lo hay', () => {
    const agencyTeam = { team: 'Bhayangkara FC', apiTeamId: 2443 }
    expect(resolveDisplayClub(null, agencyTeam)).toBe('Bhayangkara FC')
  })

  it('sin partidos y sin dato de agencia, devuelve null', () => {
    expect(resolveDisplayClub(null, null)).toBeNull()
  })

  it('jugador de agencia sin apiTeamId conocido: no puede comparar, usa el último partido', () => {
    const matchClub = { teamId: 9, teamName: 'Club Nacional', leagueId: 268 }
    const agencyTeam = { team: 'Bhayangkara FC', apiTeamId: null }
    expect(resolveDisplayClub(matchClub, agencyTeam)).toBe('Club Nacional')
  })
})
