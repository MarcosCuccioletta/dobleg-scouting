import { describe, it, expect } from 'vitest'
import { countByCode, countByPhase, evolutionByMatch, pitchPoints, type StatsMatch } from './videoAnalysisStats'
import type { ParsedInstance } from './parseNacsportXml'

function inst(over: Partial<ParsedInstance> = {}): ParsedInstance {
  return { code: 'Salida en corto', start: 0, end: 1, labels: [], x: null, y: null, ...over }
}

describe('countByCode', () => {
  it('suma cortes del mismo codigo entre varios matches', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' }), inst({ code: 'Ataque' })] },
      { match_date: '2026-08-23', instances: [inst({ code: 'Salida en corto' })] },
    ]
    const result = countByCode(matches)
    expect(result).toEqual([
      { code: 'Salida en corto', count: 2 },
      { code: 'Ataque', count: 1 },
    ])
  })

  it('con 0 matches devuelve lista vacia', () => {
    expect(countByCode([])).toEqual([])
  })
})

describe('countByPhase', () => {
  it('agrupa por fase clasificada del codigo', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' }), inst({ code: 'Presión alta' })] },
    ]
    const result = countByPhase(matches)
    expect(result.ofensiva).toBe(1)
    expect(result.defensiva).toBe(1)
    expect(result.transicion).toBe(0)
    expect(result.abp).toBe(0)
    expect(result.otro).toBe(0)
  })
})

describe('evolutionByMatch', () => {
  it('ordena por fecha aunque los matches vengan desordenados', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-23', instances: [inst({ code: 'X' }), inst({ code: 'X' })] },
      { match_date: '2026-08-16', instances: [inst({ code: 'X' })] },
    ]
    const result = evolutionByMatch(matches, 'X')
    expect(result).toEqual([
      { matchDate: '2026-08-16', count: 1 },
      { matchDate: '2026-08-23', count: 2 },
    ])
  })

  it('un match sin cortes de esa categoria cuenta 0', () => {
    const matches: StatsMatch[] = [{ match_date: '2026-08-16', instances: [inst({ code: 'Otro' })] }]
    const result = evolutionByMatch(matches, 'X')
    expect(result).toEqual([{ matchDate: '2026-08-16', count: 0 }])
  })
})

describe('pitchPoints', () => {
  it('separa puntos exactos (con x/y) de zonas inferidas (sin x/y)', () => {
    const matches: StatsMatch[] = [
      {
        match_date: '2026-08-16',
        instances: [
          inst({ code: 'X', x: 62, y: 35 }),
          inst({ code: 'X', x: null, y: null }), // sin coordenadas, "X" no matchea ningun termino de zona
        ],
      },
    ]
    const result = pitchPoints(matches, 'X')
    expect(result.exact).toEqual([{ x: 62, y: 35 }])
    expect(result.zones).toEqual([])
  })

  it('usa la zona inferida cuando no hay x/y pero el codigo matchea un termino conocido', () => {
    const matches: StatsMatch[] = [{ match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' })] }]
    const result = pitchPoints(matches, 'Salida en corto')
    expect(result.exact).toEqual([])
    expect(result.zones).toEqual([{ x1: 0, y1: 67, x2: 100, y2: 100 }])
  })
})
