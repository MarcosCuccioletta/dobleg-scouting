import { describe, it, expect } from 'vitest'
import { buildScoreLookup, type ScoreLookupRow } from './playerStatsService'

const row = (over: Partial<ScoreLookupRow> & Pick<ScoreLookupRow, 'player_id' | 'name'>): ScoreLookupRow => ({
  current_team_id: null, score: 5, position: 'VC', percentile: 50, matches_played: 1,
  ...over,
})

describe('buildScoreLookup', () => {
  it('con nombres únicos, arma el mapa directo', () => {
    const rows = [row({ player_id: 1, name: 'Alexis Steimbach', matches_played: 10 })]
    const map = buildScoreLookup(rows, [])
    expect(map.get('alexis steimbach')?.player_id).toBe(1)
  })

  it('duplicado de la misma persona (API-Football vs Sofascore): gana quien jugó más', () => {
    const rows = [
      row({ player_id: 1, name: 'Juan Postigo', matches_played: 5 }),
      row({ player_id: 2, name: 'Juan Postigo', matches_played: 12 }),
    ]
    const map = buildScoreLookup(rows, [])
    expect(map.get('juan postigo')?.player_id).toBe(2)
  })

  it('dos personas distintas con el mismo nombre: el equipo de la agencia desempata, no los partidos jugados', () => {
    // Caso real: "Julián López" de Defensa y Justicia (agencia, apiTeamId 442, pocos
    // partidos por lesión/suplencia) vs otro "Julián López" de una liga menor que
    // jugó mucho más este semestre. Sin desambiguar por equipo, gana el que no es.
    const rows = [
      row({ player_id: 5917, name: 'Julián López', current_team_id: 442, matches_played: 3 }),
      row({ player_id: 22036647, name: 'Julián López', current_team_id: 20255426, matches_played: 15 }),
    ]
    const agencyPlayers = [{ fullName: 'Julián López', shortName: 'J. López', apiTeamId: 442 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('julian lopez')?.player_id).toBe(5917)
  })

  it('agrega también la key del shortName de la agencia', () => {
    const rows = [row({ player_id: 1, name: 'Julián López', current_team_id: 442, matches_played: 3 })]
    const agencyPlayers = [{ fullName: 'Julián López', shortName: 'J. López', apiTeamId: 442 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('j. lopez')?.player_id).toBe(1)
  })

  it('sin match de equipo para el jugador de la agencia, no rompe: sigue el heurístico de partidos jugados', () => {
    const rows = [
      row({ player_id: 1, name: 'Julián López', current_team_id: 999, matches_played: 3 }),
      row({ player_id: 2, name: 'Julián López', current_team_id: 888, matches_played: 15 }),
    ]
    const agencyPlayers = [{ fullName: 'Julián López', shortName: 'J. López', apiTeamId: 442 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('julian lopez')?.player_id).toBe(2)
  })
})
