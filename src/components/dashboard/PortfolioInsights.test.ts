import { describe, it, expect } from 'vitest'
import { computePortfolioInsights } from './PortfolioInsights'
import type { EnrichedPlayer, MarketValueHistoryEntry } from '@/types'

function player(over: Partial<EnrichedPlayer> & Pick<EnrichedPlayer, 'Jugador'>): EnrichedPlayer {
  return {
    Liga: '', Equipo: '', 'Posición': '', Edad: '', 'País de nacimiento': '', Pie: '', Altura: '',
    'Valor de mercado (Transfermarkt)': '', 'Vencimiento contrato': '', 'Partidos jugados': '',
    'Minutos jugados': '', Goles: '', xG: '', Asistencias: '', xA: '', 'Posición específica': '',
    id: '', Transfermkt: '', Representante: '', Imagen: '', ggScore: null, ggScorePercentile: null,
    source: 'interno', contractStatus: 'ok', monthsRemaining: null, marketValueFormatted: '',
    marketValueRaw: 0, minutesPlayed: 0, ageNum: 0,
    ...over,
  }
}

function historyEntry(over: Partial<MarketValueHistoryEntry> & Pick<MarketValueHistoryEntry, 'Jugador' | 'fecha' | 'valor'>): MarketValueHistoryEntry {
  return { idTM: '', equipo: '', edad: 0, ...over }
}

describe('computePortfolioInsights', () => {
  it('calcula la concentración del jugador más caro sobre el total', () => {
    const players = [
      player({ Jugador: 'G. Prestianni', marketValueRaw: 20_000_000 }),
      player({ Jugador: 'L. Orellano', marketValueRaw: 8_000_000 }),
      player({ Jugador: 'M. Palacios', marketValueRaw: 2_000_000 }),
    ]
    const result = computePortfolioInsights(players, [])

    expect(result.totalValue).toBe(30_000_000)
    expect(result.topPlayer).toEqual({ name: 'G. Prestianni', value: 20_000_000, share: 20 / 30 })
  })

  it('calcula el % que se llevan los 3 jugadores más caros', () => {
    const players = [
      player({ Jugador: 'A', marketValueRaw: 10_000_000 }),
      player({ Jugador: 'B', marketValueRaw: 5_000_000 }),
      player({ Jugador: 'C', marketValueRaw: 3_000_000 }),
      player({ Jugador: 'D', marketValueRaw: 2_000_000 }),
    ]
    const result = computePortfolioInsights(players, [])

    expect(result.top3Share).toBeCloseTo(18 / 20)
  })

  it('suma el valor de jugadores con contrato en estado crítico', () => {
    const players = [
      player({ Jugador: 'A', marketValueRaw: 1_000_000, contractStatus: 'critical' }),
      player({ Jugador: 'B', marketValueRaw: 2_000_000, contractStatus: 'critical' }),
      player({ Jugador: 'C', marketValueRaw: 3_000_000, contractStatus: 'ok' }),
    ]
    const result = computePortfolioInsights(players, [])

    expect(result.atRiskValue).toBe(3_000_000)
    expect(result.atRiskCount).toBe(2)
  })

  it('encuentra al jugador con mayor variación de valor entre el último y el penúltimo snapshot (no la carrera entera)', () => {
    const players = [player({ Jugador: 'A', marketValueRaw: 1 }), player({ Jugador: 'B', marketValueRaw: 1 })]
    const history: MarketValueHistoryEntry[] = [
      historyEntry({ Jugador: 'A', fecha: new Date('2026-01-01'), valor: 1_000_000 }),
      historyEntry({ Jugador: 'A', fecha: new Date('2026-06-01'), valor: 1_100_000 }), // +10%
      historyEntry({ Jugador: 'B', fecha: new Date('2026-01-01'), valor: 5_000_000 }),
      historyEntry({ Jugador: 'B', fecha: new Date('2026-06-01'), valor: 2_500_000 }), // -50%
    ]
    const result = computePortfolioInsights(players, history)

    expect(result.biggestMover).toEqual({ name: 'B', changePct: -50, direction: 'down' })
  })

  it('ignora el salto histórico viejo y mira solo el último período (caso real: valor multiplicado x100 desde que el jugador era juvenil)', () => {
    const players = [player({ Jugador: 'A', marketValueRaw: 1 })]
    const history: MarketValueHistoryEntry[] = [
      historyEntry({ Jugador: 'A', fecha: new Date('2022-01-01'), valor: 80_000 }),
      historyEntry({ Jugador: 'A', fecha: new Date('2025-12-18'), valor: 12_000_000 }),
      historyEntry({ Jugador: 'A', fecha: new Date('2026-06-01'), valor: 13_000_000 }), // +8.3% en el último período
    ]
    const result = computePortfolioInsights(players, history)

    expect(result.biggestMover?.changePct).toBeCloseTo(((13_000_000 - 12_000_000) / 12_000_000) * 100)
  })

  it('ignora jugadores con una sola entrada de historial (no hay variación que calcular)', () => {
    const players = [player({ Jugador: 'A', marketValueRaw: 1 })]
    const history: MarketValueHistoryEntry[] = [
      historyEntry({ Jugador: 'A', fecha: new Date('2026-01-01'), valor: 1_000_000 }),
    ]
    const result = computePortfolioInsights(players, history)

    expect(result.biggestMover).toBeNull()
  })

  it('sin jugadores con valor, totalValue es 0 y topPlayer/top3Share quedan vacíos', () => {
    const result = computePortfolioInsights([], [])

    expect(result.totalValue).toBe(0)
    expect(result.topPlayer).toBeNull()
    expect(result.top3Share).toBe(0)
  })
})
