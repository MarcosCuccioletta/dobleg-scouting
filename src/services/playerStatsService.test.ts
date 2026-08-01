import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildScoreLookup, currentSeasons, type ScoreLookupRow } from './playerStatsService'

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

  it('mismo jugador con un fragmento de 1 partido en el mismo equipo: no debe pisar el score real con el del fragmento (caso real José Paradela)', () => {
    // Caso real: José Paradela (Cruz Azul, agencia apiTeamId 2295) tiene 31 partidos
    // en VI con score 6.5, pero su id de API-Football también quedó con una fila
    // fragmentada de 1 solo partido detectado como EXT y score 4.2 (misma persona,
    // mismo equipo). El desempate por equipo agarraba "la primera fila que matchee"
    // sin mirar partidos jugados, y en producción esa fila resultó ser el fragmento:
    // la ficha mostraba 4.2 en vez de 6.5. El fragmento va primero en el array a
    // propósito, para reproducir el orden real que vino de la consulta.
    const rows = [
      row({ player_id: 6441, name: 'José Paradela', current_team_id: 2295, matches_played: 1, score: 4.2, position: 'EXT' }),
      row({ player_id: 6441, name: 'José Paradela', current_team_id: 2295, matches_played: 31, score: 6.5, position: 'VI' }),
      row({ player_id: 20944623, name: 'José Paradela', current_team_id: 20001947, matches_played: 8, score: 7.7, position: 'VI' }),
    ]
    const agencyPlayers = [{ fullName: 'José Paradela', shortName: 'J. Paradela', apiTeamId: 2295 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('jose paradela')?.score).toBe(6.5)
    expect(map.get('jose paradela')?.matches_played).toBe(31)
  })
})

describe('currentSeasons', () => {
  afterEach(() => vi.useRealTimers())

  it('en agosto (temporada europea recién arrancada) sigue incluyendo el año anterior', () => {
    // Caso real: 2026-08-01. Prestianni (Benfica), Palacios (Al Ain) y otros quedaban
    // sin score porque la función vieja devolvía sólo [2026] y su fila vigente
    // todavía estaba en season=2025 (la 2025/26 europea, en curso).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01'))
    expect(currentSeasons()).toEqual([2025, 2026])
  })

  it('a mitad de temporada europea (marzo) también incluye ambos años', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15'))
    expect(currentSeasons()).toEqual([2025, 2026])
  })

  it('en diciembre incluye el año en curso y el anterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-20'))
    expect(currentSeasons()).toEqual([2025, 2026])
  })
})
