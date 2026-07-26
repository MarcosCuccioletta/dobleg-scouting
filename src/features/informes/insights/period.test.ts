import { describe, it, expect } from 'vitest'
import { toISODate, seasonStart, resolvePeriod, inPeriod } from './period'
import type { TeamFixture } from './types'

function fx(id: number, date: string): TeamFixture {
  return { id, date, league_id: 262, home_team_id: 1, away_team_id: 2, score_home: 1, score_away: 0 }
}

describe('toISODate', () => {
  it('recorta a YYYY-MM-DD', () => {
    expect(toISODate('2026-03-01T01:05:00+00:00')).toBe('2026-03-01')
  })
})

describe('seasonStart', () => {
  it('arranca en el partido siguiente al último hueco de 45+ días', () => {
    const fixtures = [
      fx(1, '2025-08-01T00:00:00Z'),
      fx(2, '2025-08-08T00:00:00Z'),
      fx(3, '2025-12-10T00:00:00Z'), // hueco de 4 meses: acá arranca la temporada
      fx(4, '2025-12-17T00:00:00Z'),
    ]
    expect(seasonStart(fixtures)).toBe('2025-12-10')
  })

  it('sin huecos largos devuelve el primer partido', () => {
    const fixtures = [fx(1, '2026-01-10T00:00:00Z'), fx(2, '2026-01-17T00:00:00Z')]
    expect(seasonStart(fixtures)).toBe('2026-01-10')
  })

  it('sin partidos devuelve null', () => {
    expect(seasonStart([])).toBeNull()
  })
})

describe('resolvePeriod', () => {
  const fixtures = Array.from({ length: 12 }, (_, i) =>
    fx(i + 1, `2026-0${Math.floor(i / 4) + 1}-0${(i % 4) + 1}T00:00:00Z`),
  )

  it('signing ancla en la fecha de llegada', () => {
    const p = resolvePeriod({ mode: 'signing' }, { signingDate: '2025-07-11', fixtures })
    expect(p).toEqual({ mode: 'signing', from: '2025-07-11', to: null, anchorDate: '2025-07-11' })
  })

  it('signing sin fecha de llegada cae a temporada', () => {
    const p = resolvePeriod({ mode: 'signing' }, { signingDate: null, fixtures })
    expect(p.mode).toBe('season')
  })

  it('last10 arranca en el décimo partido contando hacia atrás', () => {
    const p = resolvePeriod({ mode: 'last10' }, { signingDate: null, fixtures })
    expect(p.mode).toBe('last10')
    expect(p.from).toBe('2026-01-03')
  })

  it('custom respeta el rango dado', () => {
    const p = resolvePeriod({ mode: 'custom', from: '2026-02-01', to: '2026-03-01' }, { signingDate: null, fixtures })
    expect(p).toEqual({ mode: 'custom', from: '2026-02-01', to: '2026-03-01', anchorDate: null })
  })
})

describe('inPeriod', () => {
  const p = { mode: 'custom' as const, from: '2026-02-01', to: '2026-03-01', anchorDate: null }

  it('incluye los bordes', () => {
    expect(inPeriod('2026-02-01T20:00:00Z', p)).toBe(true)
    expect(inPeriod('2026-03-01T20:00:00Z', p)).toBe(true)
  })

  it('excluye fuera de rango', () => {
    expect(inPeriod('2026-01-31T20:00:00Z', p)).toBe(false)
    expect(inPeriod('2026-03-02T20:00:00Z', p)).toBe(false)
  })

  it('to null = abierto hacia adelante', () => {
    expect(inPeriod('2030-01-01T00:00:00Z', { ...p, to: null })).toBe(true)
  })
})
