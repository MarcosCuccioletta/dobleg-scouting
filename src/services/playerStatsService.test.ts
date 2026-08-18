import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildScoreLookup, currentSeasons, dedupeSeasonScoresByPosition, type ScoreLookupRow } from './playerStatsService'
import type { PlayerSeasonScore } from '@/types/scoring'

const row = (over: Partial<ScoreLookupRow> & Pick<ScoreLookupRow, 'player_id' | 'name'>): ScoreLookupRow => ({
  current_team_id: null, transfermarkt_id: null, birth_date: null,
  score: 5, position: 'VC', percentile: 50, matches_played: 1,
  ...over,
})

const seasonScore = (
  over: Partial<PlayerSeasonScore> & Pick<PlayerSeasonScore, 'player_id' | 'season' | 'position'>,
): PlayerSeasonScore => ({
  league_id: 1, matches_played: 1, avg_score: 5, avg_rating: null,
  total_goals: 0, total_assists: 0, percentile: null, global_percentile: null,
  tackles_p90: null, interceptions_p90: null, blocks_p90: null, duels_won_pct: null,
  passes_accuracy: null, passes_key_p90: null, passes_total_p90: null,
  dribbles_success_p90: null, dribbles_pct: null, shots_on_p90: null, shots_pct: null,
  goals_p90: null, assists_p90: null, fouls_drawn_p90: null, saves_p90: null,
  goals_conceded_p90: null, penalty_saved_avg: null, clean_sheet_pct: null,
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
    // mismo equipo, mismo transfermarkt_id). El fragmento va primero en el array a
    // propósito, para reproducir el orden real que vino de la consulta.
    const rows = [
      row({ player_id: 6441, name: 'José Paradela', current_team_id: 2295, transfermarkt_id: 639152, matches_played: 1, score: 4.2, position: 'EXT' }),
      row({ player_id: 6441, name: 'José Paradela', current_team_id: 2295, transfermarkt_id: 639152, matches_played: 31, score: 6.5, position: 'VI' }),
      row({ player_id: 20944623, name: 'José Paradela', current_team_id: 20001947, transfermarkt_id: 639152, matches_played: 8, score: 7.7, position: 'VI' }),
    ]
    const agencyPlayers = [{ fullName: 'José Paradela', shortName: 'J. Paradela', apiTeamId: 2295 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('jose paradela')?.score).toBe(6.5)
    expect(map.get('jose paradela')?.matches_played).toBe(31)
  })

  it('mismo transfermarkt_id, equipos distintos (API-Football desactualizado vs Sofascore al día): igual se fusionan como una sola identidad', () => {
    // El id de Sofascore de un jugador puede tener el `current_team_id` distinto del
    // id de API-Football (uno de los dos syncs se actualiza primero tras un
    // traspaso). El id de Transfermarkt no cambia: es la señal de identidad
    // confiable, no el equipo.
    const rows = [
      row({ player_id: 100, name: 'Nahuel Duplicado', current_team_id: 111, transfermarkt_id: 555, matches_played: 4 }),
      row({ player_id: 200, name: 'Nahuel Duplicado', current_team_id: 222, transfermarkt_id: 555, matches_played: 9 }),
    ]
    const map = buildScoreLookup(rows, [])
    expect(map.get('nahuel duplicado')?.player_id).toBe(200)
  })

  it('dos personas reales con el mismo nombre, sin equipo de agencia conocido: transfermarkt_id/fecha de nacimiento alcanzan para separarlas', () => {
    // Antes esto dependía por completo del apiTeamId del jugador de agencia. Con
    // identidad real (transfermarkt_id/fecha de nacimiento) alcanza para no
    // mezclarlos, sin necesitar ese dato adicional.
    const rows = [
      row({ player_id: 5917, name: 'Julián López', transfermarkt_id: 625203, birth_date: '2000-01-08', matches_played: 3 }),
      row({ player_id: 22036647, name: 'Julián López', transfermarkt_id: 554435, birth_date: '1991-09-14', matches_played: 15 }),
    ]
    // Sin agencyPlayers: nadie desempata por equipo, y aun así no se mezclan.
    const map = buildScoreLookup(rows, [])
    // Gana por partidos jugados entre identidades reales distintas (comportamiento
    // esperado sin más contexto) — lo importante es que NO fusiona ambas en una.
    expect(map.get('julian lopez')?.player_id).toBe(22036647)
    expect(map.get('julian lopez')?.matches_played).toBe(15)
  })

  it('jugador de agencia recién transferido: el equipo nuevo con MENOS partidos gana al equipo viejo con MÁS (caso real Mauricio Vera)', () => {
    // Caso real: Mauricio Vera se transfirió a Bhayangkara FC (apiTeamId 2443). Su
    // fila vieja (Nacional, Sofascore) tiene 4 partidos y score 3.9; su fila nueva
    // (Bhayangkara, API-Football) recién tiene 2 partidos y score 6.8. Antes de este
    // fix, el paso 1 (identidad por transfermarkt_id) se quedaba con la fila de más
    // partidos — la vieja — y la descartaba de `representatives`, así que el
    // desempate por equipo del paso 2 nunca llegaba a verla: la lista mostraba 3.9
    // mientras la ficha individual (que resuelve distinto) mostraba el 6.8 correcto.
    const rows = [
      row({ player_id: 21022801, name: 'Mauricio Vera', current_team_id: 20003230, transfermarkt_id: 697408, matches_played: 4, score: 3.9 }),
      row({ player_id: 133613, name: 'Mauricio Vera', current_team_id: 2443, transfermarkt_id: 697408, matches_played: 2, score: 6.8 }),
    ]
    const agencyPlayers = [{ fullName: 'Mauricio Vera', shortName: 'M. Vera', apiTeamId: 2443 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('mauricio vera')?.player_id).toBe(133613)
    expect(map.get('mauricio vera')?.score).toBe(6.8)
  })

  it('mismo caso, orden de filas invertido: el resultado no depende de qué fila aparece primero', () => {
    const rows = [
      row({ player_id: 133613, name: 'Mauricio Vera', current_team_id: 2443, transfermarkt_id: 697408, matches_played: 2, score: 6.8 }),
      row({ player_id: 21022801, name: 'Mauricio Vera', current_team_id: 20003230, transfermarkt_id: 697408, matches_played: 4, score: 3.9 }),
    ]
    const agencyPlayers = [{ fullName: 'Mauricio Vera', shortName: 'M. Vera', apiTeamId: 2443 }]

    const map = buildScoreLookup(rows, agencyPlayers)

    expect(map.get('mauricio vera')?.player_id).toBe(133613)
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

describe('dedupeSeasonScoresByPosition', () => {
  it('sin filas repetidas, las deja igual', () => {
    const scores = [
      seasonScore({ player_id: 1, season: 2026, position: 'EXT' }),
      seasonScore({ player_id: 1, season: 2026, position: 'VC' }),
    ]
    expect(dedupeSeasonScoresByPosition(scores)).toHaveLength(2)
  })

  it('caso real Santiago Montiel: dos filas EXT (2025 y 2026) -- se queda con la de 2026', () => {
    // currentSeasons() trae [2025, 2026] por diseño (ver test de arriba), asi que un
    // jugador con datos en ambos anos para la misma posicion trae 2 filas -- sin
    // deduplicar, "Score por posicion" las mostraba como si fueran dos posiciones
    // distintas en vez de la misma posicion en dos temporadas.
    const scores = [
      seasonScore({ player_id: 265973, season: 2025, position: 'EXT', matches_played: 7, avg_score: 5.4 }),
      seasonScore({ player_id: 265973, season: 2026, position: 'EXT', matches_played: 6, avg_score: 6.1 }),
    ]
    const deduped = dedupeSeasonScoresByPosition(scores)
    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({ season: 2026, avg_score: 6.1 })
  })

  it('temporada mas nueva gana sin importar el orden de entrada', () => {
    const scores = [
      seasonScore({ player_id: 1, season: 2026, position: 'EXT', avg_score: 6.1 }),
      seasonScore({ player_id: 1, season: 2025, position: 'EXT', avg_score: 5.4 }),
    ]
    expect(dedupeSeasonScoresByPosition(scores)[0].season).toBe(2026)
  })
})
