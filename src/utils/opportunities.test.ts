import { describe, it, expect } from 'vitest'
import { marketTagsFor, contractBoostFor, opportunityScoreFor } from './opportunities'
import type { RecentFormPlayer } from '@/types/scoring'

function mk(over: Partial<RecentFormPlayer>): RecentFormPlayer {
  return {
    id: 1, name: 'X', photo: null, team: null, league_name: null, primary_position: 'EXT',
    birth_date: '2002-01-01', market_value_eur: null, contract_end_date: null,
    primary_score: 6, recent_avg: 7.5, recent_matches: 4, recent_scores: [7, 8, 7, 8],
    on_the_rise: true, window_used: 'window', ...over,
  }
}

describe('marketTagsFor', () => {
  const opts = { cheapMaxValue: 2_000_000, contractMaxMonths: 12 }
  it('marca precio bajo', () => {
    expect(marketTagsFor(mk({ market_value_eur: 1_000_000 }), opts)).toContain('cheap')
  })
  it('marca fin de contrato', () => {
    const soon = new Date(); soon.setMonth(soon.getMonth() + 6)
    expect(marketTagsFor(mk({ contract_end_date: soon.toISOString().slice(0, 10) }), opts)).toContain('contract')
  })
  it('sin condición => vacío', () => {
    expect(marketTagsFor(mk({ market_value_eur: 50_000_000 }), opts)).toEqual([])
  })
})

function dateInMonths(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

describe('contractBoostFor', () => {
  it('boost máximo cuando el contrato vence este mes', () => {
    expect(contractBoostFor(dateInMonths(0))).toBeCloseTo(1.5, 1)
  })
  it('boost a mitad de camino a los 6 meses', () => {
    expect(contractBoostFor(dateInMonths(6))).toBeCloseTo(0.75, 1)
  })
  it('boost cero a los 12 meses', () => {
    expect(contractBoostFor(dateInMonths(12))).toBeCloseTo(0, 1)
  })
  it('boost cero más allá de 12 meses', () => {
    expect(contractBoostFor(dateInMonths(24))).toBe(0)
  })
  it('boost cero sin fecha de contrato', () => {
    expect(contractBoostFor(null)).toBe(0)
  })
  it('contrato ya vencido satura en el boost máximo', () => {
    expect(contractBoostFor(dateInMonths(-3))).toBeCloseTo(1.5, 1)
  })
})

describe('opportunityScoreFor', () => {
  it('suma el score reciente y el boost por contrato', () => {
    const p = mk({ recent_avg: 7, contract_end_date: dateInMonths(6) })
    expect(opportunityScoreFor(p)).toBeCloseTo(7.75, 1)
  })
  it('sin contrato, el opportunity_score es igual al recent_avg', () => {
    const p = mk({ recent_avg: 7, contract_end_date: null })
    expect(opportunityScoreFor(p)).toBe(7)
  })
})
