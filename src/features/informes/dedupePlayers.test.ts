import { describe, it, expect } from 'vitest'
import { dedupePlayers } from './dedupePlayers'
import type { PlayerWithScore } from '@/types/scoring'

function player(over: Partial<PlayerWithScore>): PlayerWithScore {
  return {
    id: 1, name: 'José Paradela', photo: null, birth_date: '1998-12-15', nationality: null,
    preferred_foot: null, height_cm: null, current_team_id: null, primary_position: 'VI',
    position_distribution: {}, market_value_eur: null, contract_end_date: null, agent: null,
    transfermarkt_url: null, transfermarkt_id: 639152, season_scores: [], primary_score: null,
    primary_percentile: null, ...over,
  } as PlayerWithScore
}

const API = 'https://media.api-sports.io/football/players/6441.png'
const SOFA = 'https://api.sofascore.com/api/v1/player/944623/image'

describe('dedupePlayers', () => {
  it('deja una sola fila por jugador y se queda con la de API-Football', () => {
    const out = dedupePlayers([
      player({ id: 20944623, photo: SOFA }),
      player({ id: 6441, photo: API }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(6441)
  })

  it('no depende del orden en que vienen', () => {
    const out = dedupePlayers([
      player({ id: 6441, photo: API }),
      player({ id: 20944623, photo: SOFA }),
    ])
    expect(out.map(p => p.id)).toEqual([6441])
  })

  it('sin transfermarkt_id usa nombre + fecha de nacimiento', () => {
    const out = dedupePlayers([
      player({ id: 20944623, photo: SOFA, transfermarkt_id: null }),
      player({ id: 6441, photo: API, transfermarkt_id: null }),
    ])
    expect(out.map(p => p.id)).toEqual([6441])
  })

  it('no mezcla jugadores distintos', () => {
    const out = dedupePlayers([
      player({ id: 6441, photo: API }),
      player({ id: 313080, name: 'Federico Paradela', birth_date: '2001-07-03', transfermarkt_id: 890130, photo: API }),
    ])
    expect(out).toHaveLength(2)
  })

  it('si sólo está la de Sofascore la deja pasar', () => {
    const out = dedupePlayers([player({ id: 20944623, photo: SOFA })])
    expect(out.map(p => p.id)).toEqual([20944623])
  })

  it('entre dos del mismo origen gana la que tiene más partidos', () => {
    const out = dedupePlayers([
      player({ id: 20944623, photo: SOFA, season_scores: [{ matches_played: 8 } as never] }),
      player({ id: 99000001, photo: null, season_scores: [{ matches_played: 44 } as never] }),
    ])
    expect(out.map(p => p.id)).toEqual([99000001])
  })

  it('mismo transfermarkt_id pero SIN confirmar (del saneamiento de datos): no se fusiona', () => {
    // Mismo caso que el test equivalente en playerStatsService.test.ts — acá con la
    // lista de confirmados vacía (nada validado todavía) para el mismo id compartido.
    const confirmed = new Set<number>() // 999 no está confirmado
    const out = dedupePlayers([
      player({ id: 300, name: 'Danilo', transfermarkt_id: 999 }),
      player({ id: 400, name: 'Danilo Santos', birth_date: '1990-01-01', transfermarkt_id: 999 }),
    ], confirmed)
    expect(out).toHaveLength(2)
  })
})
