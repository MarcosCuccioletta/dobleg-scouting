import { describe, it, expect } from 'vitest'
import { computeInsights, type InsightsInput } from './compute'
import type { PlayerMatchRow, SquadMatchRow, TeamFixture } from './types'

const TEAM = 100
const RIVAL = 200
const PLAYER = 1

function fixture(id: number, date: string, gf: number, ga: number): TeamFixture {
  return { id, date, league_id: 262, home_team_id: TEAM, away_team_id: RIVAL, score_home: gf, score_away: ga }
}

function mine(fixtureId: number, date: string, p: Partial<PlayerMatchRow> = {}): PlayerMatchRow {
  return {
    player_id: PLAYER, player_name: 'Protagonista', fixture_id: fixtureId, date,
    minutes: 90, goals: 0, assists: 0, passes_key: 0, duels_won: 0, duels_total: 0,
    dribbles_success: 0, dribbles_attempted: 0, rating: 7, detected_position: 'VI',
    is_substitute: false, team_id: TEAM, home_team_id: TEAM, away_team_id: RIVAL,
    score_home: 1, score_away: 0, ...p,
  }
}

function squadRow(playerId: number, fixtureId: number, p: Partial<SquadMatchRow> = {}): SquadMatchRow {
  return {
    player_id: playerId, player_name: `P${playerId}`, fixture_id: fixtureId, date: '2026-02-01T00:00:00Z',
    minutes: 90, goals: 0, assists: 0, passes_key: 0, duels_won: 0, duels_total: 0,
    dribbles_success: 0, dribbles_attempted: 0, rating: 6.5, detected_position: 'EXT', ...p,
  }
}

function baseInput(over: Partial<InsightsInput> = {}): InsightsInput {
  const fixtures = [
    fixture(1, '2026-02-01T00:00:00Z', 2, 0),
    fixture(2, '2026-02-08T00:00:00Z', 1, 1),
    fixture(3, '2026-02-15T00:00:00Z', 0, 2),
    fixture(4, '2026-02-22T00:00:00Z', 1, 0),
  ]
  return {
    playerId: PLAYER,
    teamId: TEAM,
    period: { mode: 'season', from: '2026-01-01', to: null, anchorDate: null },
    fixtures,
    playerMatches: [
      mine(1, '2026-02-01T00:00:00Z', { goals: 1 }),
      mine(2, '2026-02-08T00:00:00Z', { assists: 1, is_substitute: true, minutes: 30 }),
      mine(3, '2026-02-15T00:00:00Z', { minutes: 90 }),
    ],
    squadRows: [
      squadRow(PLAYER, 1, { goals: 1 }), squadRow(PLAYER, 2, { assists: 1 }), squadRow(PLAYER, 3),
      squadRow(2, 1, { goals: 1 }), squadRow(2, 2, { goals: 1 }), squadRow(2, 3),
      squadRow(3, 4, { goals: 1 }),
    ],
    injuries: [],
    blocks: ['continuidad', 'ofensivo'],
    ...over,
  }
}

function itemById(res: ReturnType<typeof computeInsights>, id: string) {
  return res.groups.flatMap(g => g.items).find(i => i.id === id)
}

describe('computeInsights — continuidad', () => {
  it('cuenta partidos del club, disputados, titularidades y minutos', () => {
    const res = computeInsights(baseInput())
    expect(itemById(res, 'cont.pj')!.values).toMatchObject({ played: 3, teamMatches: 4, pct: 75 })
    expect(itemById(res, 'cont.titulares')!.values).toMatchObject({ starts: 2, played: 3 })
    expect(itemById(res, 'cont.minutos')!.values).toMatchObject({ minutes: 210 })
  })

  it('marca tono strong cuando jugó todos los partidos', () => {
    const input = baseInput()
    input.playerMatches = [...input.playerMatches, mine(4, '2026-02-22T00:00:00Z')]
    const res = computeInsights(input)
    expect(itemById(res, 'cont.pj')!.values.pct).toBe(100)
    expect(itemById(res, 'cont.pj')!.tone).toBe('strong')
  })

  it('cuenta los partidos perdidos dentro de una ventana de lesión', () => {
    const res = computeInsights(baseInput({ injuries: [{ type: 'Knee injury', start: '2026-02-20', end: '2026-03-01' }] }))
    expect(itemById(res, 'cont.lesiones')!.values).toMatchObject({ missed: 1 })
  })

  it('no emite la línea de lesiones si no se perdió ningún partido por lesión', () => {
    expect(itemById(computeInsights(baseInput()), 'cont.lesiones')).toBeUndefined()
  })

  it('ignora partidos fuera del período', () => {
    const input = baseInput()
    input.period = { mode: 'custom', from: '2026-02-10', to: null, anchorDate: null }
    const res = computeInsights(input)
    expect(itemById(res, 'cont.pj')!.values).toMatchObject({ played: 1, teamMatches: 2 })
  })
})

describe('computeInsights — peso ofensivo', () => {
  it('calcula participaciones, share y promedios', () => {
    const res = computeInsights(baseInput())
    expect(itemById(res, 'ofe.participaciones')!.values).toMatchObject({ goals: 1, assists: 1, ga: 2 })
    // goles del club por fixtures: 2+1+0+1 = 4; por plantel: 4. share = 2/4
    expect(itemById(res, 'ofe.share')!.values).toMatchObject({ ga: 2, teamGoals: 4, pct: 50 })
    expect(itemById(res, 'ofe.share')!.tone).toBe('strong')
    expect(itemById(res, 'ofe.promedio')!.values).toMatchObject({ perMatch: 0.67 })
    expect(itemById(res, 'ofe.cada')!.values).toMatchObject({ every: 1.5 })
  })

  it('el override manual de goles del club gana sobre el cálculo', () => {
    const res = computeInsights(baseInput({ overrides: { teamGoals: 8 } }))
    expect(itemById(res, 'ofe.share')!.values).toMatchObject({ teamGoals: 8, pct: 25 })
  })

  it('avisa cuando fixtures y plantel no coinciden en los goles del club', () => {
    const input = baseInput()
    // El partido 4 sí está cargado (hay filas del plantel) pero le falta el gol.
    input.squadRows = input.squadRows.map(r => (r.fixture_id === 4 ? { ...r, goals: 0 } : r))
    const res = computeInsights(input)
    expect(res.warnings).toContain('goalsMismatch')
    expect(itemById(res, 'ofe.share')!.values.teamGoals).toBe(4) // se queda con el mayor
  })

  it('no cuenta los partidos del club sin datos del plantel (competencia no cargada)', () => {
    const input = baseInput()
    input.squadRows = input.squadRows.filter(r => r.fixture_id !== 4) // ese partido no está en la base
    const res = computeInsights(input)
    expect(res.warnings).toContain('partialCoverage')
    expect(res.warnings).not.toContain('goalsMismatch')
    // 3 partidos del club, no 4: el que no tiene datos no infla el denominador.
    expect(itemById(res, 'cont.pj')!.values).toMatchObject({ played: 3, teamMatches: 3, pct: 100 })
    expect(itemById(res, 'ofe.share')!.values.teamGoals).toBe(3)
  })

  it('tono weak con share bajo', () => {
    const input = baseInput({ overrides: { teamGoals: 40 } })
    expect(itemById(computeInsights(input), 'ofe.share')!.tone).toBe('weak')
  })

  it('sin fixtures del club no emite share y avisa', () => {
    const res = computeInsights(baseInput({ fixtures: [], squadRows: [] }))
    expect(itemById(res, 'ofe.share')).toBeUndefined()
    expect(res.warnings).toContain('noTeamFixtures')
  })

  it('con menos de 3 partidos no emite promedios y avisa muestra corta', () => {
    const input = baseInput()
    input.playerMatches = [mine(1, '2026-02-01T00:00:00Z', { goals: 1 })]
    const res = computeInsights(input)
    expect(res.warnings).toContain('shortSample')
    expect(itemById(res, 'ofe.promedio')).toBeUndefined()
    expect(itemById(res, 'ofe.participaciones')).toBeDefined()
  })

  it('sin participaciones no enuncia el share', () => {
    const input = baseInput()
    input.playerMatches = input.playerMatches.map(m => ({ ...m, goals: 0, assists: 0 }))
    const res = computeInsights(input)
    expect(itemById(res, 'ofe.share')).toBeUndefined()
    expect(res.tiles.map(t => t.id)).not.toContain('tile.share')
  })
})

describe('computeInsights — muestra corta', () => {
  function shortInput(blocks: InsightsInput['blocks']) {
    const input = baseInput({ blocks, percentile: 78 })
    input.playerMatches = [mine(1, '2026-02-01T00:00:00Z', { rating: 9 })]
    return input
  }

  it('no rankea en el plantel con menos de 3 partidos', () => {
    const res = computeInsights(shortInput(['plantel']))
    expect(res.groups.find(g => g.id === 'plantel')).toBeUndefined()
  })

  it('no promedia el rendimiento, pero conserva el percentil', () => {
    const res = computeInsights(shortInput(['rendimiento']))
    expect(itemById(res, 'rend.promedio')).toBeUndefined()
    expect(itemById(res, 'rend.percentil')).toBeDefined()
  })

  it('no enuncia titularidades con un solo partido', () => {
    const res = computeInsights(shortInput(['continuidad']))
    expect(itemById(res, 'cont.titulares')).toBeUndefined()
    expect(itemById(res, 'cont.pj')).toBeDefined()
  })
})

describe('computeInsights — tarjetas', () => {
  it('arma la tarjeta de partidos con dots y la de share con donut', () => {
    const res = computeInsights(baseInput())
    const pj = res.tiles.find(t => t.id === 'tile.pj')!
    expect(pj.render).toBe('dots')
    expect(pj.dots).toEqual({ filled: 3, total: 4 })
    const share = res.tiles.find(t => t.id === 'tile.share')!
    expect(share.render).toBe('donut')
    expect(share.pct).toBe(50)
  })

  it('sólo incluye tarjetas de bloques activos', () => {
    const res = computeInsights(baseInput({ blocks: ['continuidad'] }))
    expect(res.tiles.map(t => t.id)).toContain('tile.pj')
    expect(res.tiles.map(t => t.id)).not.toContain('tile.share')
  })
})

describe('computeInsights — lugar en el plantel', () => {
  function planteInput() {
    const input = baseInput({ blocks: ['plantel'] })
    // Protagonista: 3 asistencias de 5 del equipo, 20 pases clave de 50.
    input.squadRows = [
      squadRow(PLAYER, 1, { assists: 2, passes_key: 10, minutes: 90, duels_won: 6, duels_total: 10, rating: 7.5 }),
      squadRow(PLAYER, 2, { assists: 1, passes_key: 10, minutes: 90, duels_won: 6, duels_total: 10, rating: 7.5 }),
      squadRow(PLAYER, 3, { passes_key: 0, minutes: 300, duels_won: 0, duels_total: 0, rating: 7.5 }),
      squadRow(2, 1, { assists: 2, passes_key: 20, minutes: 480, rating: 6.0 }),
      squadRow(3, 1, { passes_key: 10, minutes: 480, rating: 6.0 }),
      squadRow(4, 1, { minutes: 90, rating: 9.9 }),
    ]
    input.minMinutes = 400
    return input
  }

  it('emite puesto y share en asistencias', () => {
    const res = computeInsights(planteInput())
    expect(itemById(res, 'plantel.assists')!.values).toMatchObject({ rank: 1, value: 3, teamTotal: 5, pct: 60 })
  })

  it('no emite líneas de ranking irrelevantes', () => {
    const input = planteInput()
    // 20 goles del equipo, ninguno del protagonista: no debe salir la línea de goles.
    input.squadRows.push(squadRow(5, 2, { goals: 20, minutes: 480 }))
    const res = computeInsights(input)
    expect(itemById(res, 'plantel.goals')).toBeUndefined()
  })

  it('el suplente con 9.9 de score no aparece en el ranking de eficacia', () => {
    const res = computeInsights(planteInput())
    expect(itemById(res, 'plantel.score')!.values).toMatchObject({ rank: 1, pool: 3 })
  })

  it('reporta el umbral usado para que el informe lo pueda enunciar', () => {
    const res = computeInsights(planteInput())
    expect(res.minMinutes).toBe(400)
    expect(itemById(res, 'plantel.score')!.values.minMinutes).toBe(400)
  })
})

describe('computeInsights — rendimiento', () => {
  function rendInput() {
    const input = baseInput({ blocks: ['rendimiento'], percentile: 82 })
    input.playerMatches = [
      mine(1, '2026-02-01T00:00:00Z', { rating: 6.0 }),
      mine(2, '2026-02-08T00:00:00Z', { rating: 6.0 }),
      mine(3, '2026-02-15T00:00:00Z', { rating: 7.0 }),
      mine(4, '2026-02-22T00:00:00Z', { rating: 8.0 }),
    ]
    return input
  }

  it('promedia el Score GG y marca el mejor partido', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.promedio')!.values).toMatchObject({ avg: 6.8, matches: 4 })
    expect(itemById(res, 'rend.mejor')!.values).toMatchObject({ best: 8 })
  })

  it('detecta subida cuando los últimos partidos superan a los anteriores', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.tendencia')!.values.direction).toBe('up')
  })

  it('llama sostenido a una diferencia menor a 0,3', () => {
    const input = rendInput()
    input.playerMatches = input.playerMatches.map(m => ({ ...m, rating: 7 }))
    const res = computeInsights(input)
    expect(itemById(res, 'rend.tendencia')!.values.direction).toBe('flat')
  })

  it('incluye el percentil de la posición cuando el informe lo tiene', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.percentil')!.values).toMatchObject({ pct: 82 })
  })

  it('arma la tarjeta de score', () => {
    const res = computeInsights(rendInput())
    expect(res.tiles.find(t => t.id === 'tile.score')!.values).toMatchObject({ avg: 6.8 })
  })
})

describe('computeInsights — impacto en resultados', () => {
  it('compara puntos por partido con y sin él', () => {
    const input = baseInput({ blocks: ['resultados'] })
    input.fixtures = [
      fixture(1, '2026-02-01T00:00:00Z', 2, 0), // con él, ganó
      fixture(2, '2026-02-08T00:00:00Z', 1, 1), // con él, empató
      fixture(3, '2026-02-15T00:00:00Z', 0, 2), // con él, perdió
      fixture(4, '2026-02-22T00:00:00Z', 0, 1), // sin él, perdió
      fixture(5, '2026-03-01T00:00:00Z', 0, 3), // sin él, perdió
      fixture(6, '2026-03-08T00:00:00Z', 1, 2), // sin él, perdió
    ]
    // Los partidos que jugó el equipo sin él igual tienen datos del plantel.
    input.squadRows = [...input.squadRows, squadRow(2, 5), squadRow(2, 6)]
    const res = computeInsights(input)
    expect(itemById(res, 'res.record')!.values).toMatchObject({ wins: 1, draws: 1, losses: 1 })
    expect(itemById(res, 'res.conSinEl')!.values).toMatchObject({ withPpg: 1.33, withoutPpg: 0 })
    expect(itemById(res, 'res.conSinEl')!.tone).toBe('strong')
  })

  it('no compara si hay menos de 3 partidos sin él', () => {
    const res = computeInsights(baseInput({ blocks: ['resultados'] }))
    expect(itemById(res, 'res.record')).toBeDefined()
    expect(itemById(res, 'res.conSinEl')).toBeUndefined()
  })
})
