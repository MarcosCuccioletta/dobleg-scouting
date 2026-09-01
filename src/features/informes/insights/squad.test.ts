import { describe, it, expect } from 'vitest'
import { aggregateSquad, defaultMinMinutes, rankInSquad, isRankNoteworthy } from './squad'
import type { SquadMatchRow } from './types'

let seq = 0
function row(p: Partial<SquadMatchRow> & { player_id: number; player_name: string }): SquadMatchRow {
  return {
    fixture_id: ++seq,
    date: '2026-02-01T00:00:00Z',
    minutes: 90,
    goals: 0,
    assists: 0,
    passes_key: 0,
    duels_won: 0,
    duels_total: 0,
    dribbles_success: 0,
    dribbles_attempted: 0,
    rating: null,
    detected_position: 'EXT',
    ...p,
  }
}

describe('aggregateSquad', () => {
  it('suma por jugador y cuenta sólo los partidos con minutos', () => {
    const agg = aggregateSquad([
      row({ player_id: 1, player_name: 'Orellano', goals: 1, assists: 1, passes_key: 3, rating: 7.0 }),
      row({ player_id: 1, player_name: 'Orellano', minutes: 0, goals: 0, rating: null }),
      row({ player_id: 1, player_name: 'Orellano', minutes: 45, goals: 2, rating: 8.0 }),
    ])
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({
      playerId: 1, name: 'Orellano', matches: 2, minutes: 135, goals: 3, assists: 1, ga: 4, keyPasses: 3, scoreAvg: 7.5,
    })
  })

  it('calcula porcentajes de duelos y regates, y null si no hubo intentos', () => {
    const agg = aggregateSquad([
      row({ player_id: 1, player_name: 'A', duels_won: 6, duels_total: 10, dribbles_success: 0, dribbles_attempted: 0 }),
    ])
    expect(agg[0].duelPct).toBe(60)
    expect(agg[0].dribblePct).toBeNull()
  })

  it('marca arqueros por la posición más frecuente', () => {
    const agg = aggregateSquad([
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'ARQ' }),
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'ARQ' }),
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'CB' }),
    ])
    expect(agg[0].isKeeper).toBe(true)
    expect(agg[0].position).toBe('ARQ')
  })
})

describe('defaultMinMinutes', () => {
  it('usa 400 cuando el plantel tiene volumen', () => {
    const agg = aggregateSquad([row({ player_id: 1, player_name: 'A', minutes: 1500 })])
    expect(defaultMinMinutes(agg)).toBe(400)
  })

  it('baja al 40% del líder en períodos cortos, redondeado a 45', () => {
    const agg = aggregateSquad([row({ player_id: 1, player_name: 'A', minutes: 700 })])
    expect(defaultMinMinutes(agg)).toBe(270) // 700 * 0.4 = 280 -> 270
  })

  it('plantel vacío devuelve 0', () => {
    expect(defaultMinMinutes([])).toBe(0)
  })
})

describe('rankInSquad', () => {
  const squad = aggregateSquad([
    row({ player_id: 1, player_name: 'Orellano', minutes: 1136, goals: 3, assists: 4, passes_key: 25, duels_won: 63, duels_total: 122, rating: 6.7 }),
    row({ player_id: 2, player_name: 'Canales', minutes: 1200, goals: 1, assists: 2, passes_key: 30, duels_won: 40, duels_total: 100, rating: 6.4 }),
    row({ player_id: 3, player_name: 'Corona', minutes: 900, goals: 4, assists: 1, passes_key: 10, duels_won: 30, duels_total: 60, rating: 6.9 }),
    row({ player_id: 4, player_name: 'Juvenil', minutes: 60, goals: 0, assists: 0, passes_key: 1, duels_won: 4, duels_total: 4, rating: 9.5 }),
    row({ player_id: 5, player_name: 'Arquero', minutes: 1200, goals: 0, assists: 0, passes_key: 0, duels_won: 2, duels_total: 2, rating: 7.5, detected_position: 'ARQ' }),
  ])

  it('rankea acumuladas contra todo el plantel y calcula el share', () => {
    const r = rankInSquad(squad, 1, 'assists', { minMinutes: 400 })!
    expect(r.rank).toBe(1)
    expect(r.teamTotal).toBe(7)
    expect(r.sharePct).toBe(57.1)
  })

  it('no aplica el umbral de minutos a las acumuladas', () => {
    const r = rankInSquad(squad, 1, 'goals', { minMinutes: 400 })!
    expect(r.rank).toBe(2) // Corona 4, Orellano 3
    expect(r.poolSize).toBe(4) // los cuatro de campo
  })

  it('el umbral saca al suplente con promedio inflado', () => {
    const r = rankInSquad(squad, 1, 'scoreAvg', { minMinutes: 400 })!
    expect(r.rank).toBe(2) // Corona 6.9 > Orellano 6.7; el juvenil de 9.5 no califica
    expect(r.poolSize).toBe(3)
  })

  it('con umbral 0 el suplente entra y empuja al protagonista', () => {
    const r = rankInSquad(squad, 1, 'scoreAvg', { minMinutes: 0 })!
    expect(r.rank).toBe(3)
    expect(r.poolSize).toBe(4)
  })

  it('excluye arqueros de los rankings de campo', () => {
    const r = rankInSquad(squad, 1, 'duelPct', { minMinutes: 400 })!
    expect(r.poolSize).toBe(3) // Orellano, Canales, Corona; el arquero queda afuera
    expect(r.sharePct).toBeNull()
  })

  it('devuelve null si el protagonista no llega al umbral en una métrica de eficacia', () => {
    expect(rankInSquad(squad, 4, 'scoreAvg', { minMinutes: 400 })).toBeNull()
  })

  it('devuelve null si el jugador no está en el plantel', () => {
    expect(rankInSquad(squad, 999, 'goals', { minMinutes: 400 })).toBeNull()
  })
})

describe('isRankNoteworthy', () => {
  it('acepta top 5', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 5, poolSize: 20, value: 2, teamTotal: 40, sharePct: 5 })).toBe(true)
  })

  it('acepta share alto aunque el puesto sea malo', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 8, poolSize: 20, value: 5, teamTotal: 40, sharePct: 12.5 })).toBe(true)
  })

  it('rechaza puesto malo con share bajo', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 12, poolSize: 20, value: 1, teamTotal: 40, sharePct: 2.5 })).toBe(false)
  })
})
