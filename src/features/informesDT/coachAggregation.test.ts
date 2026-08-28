import { describe, it, expect } from 'vitest'
import {
  computeRecord, computeComparativa, computeSistemas, computeDisciplina, computeFormaReciente,
} from './coachAggregation'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'

function match(overrides: Partial<WyscoutMatch>): WyscoutMatch {
  return {
    fecha: '2026-02-06',
    partido: 'Temperley - Rival 1:0',
    competencia: 'Primera Nacional',
    equipoPropio: 'Temperley',
    equipoRival: 'Rival',
    xgFor: 1,
    xgAgainst: 0.5,
    possessionPct: 55,
    golesFor: 1,
    rawMetrics: {},
    rivalRawMetrics: {},
    ...overrides,
  }
}

const fixture: WyscoutMatch[] = [
  match({
    fecha: '2026-02-06', xgFor: 2, xgAgainst: 1, possessionPct: 60, golesFor: 2,
    rawMetrics: {
      goles_recibidos: 1, seleccionar_esquema: '4-2-3-1',
      'duelos_/_ganados_3': 55, 'duelos_aereos_/_ganados_3': 50, 'pases_/_logrados_3': 80,
      faltas: 10, tarjetas_amarillas: 2, tarjetas_rojas: 0, ppda: 8,
      'tiros_/_a_la_porteria': 12, 'tiros_en_contra_/_a_la_porteria': 8,
    },
    rivalRawMetrics: { 'pases_/_logrados_3': 75, ppda: 10 },
  }),
  match({
    fecha: '2026-02-14', xgFor: 0.5, xgAgainst: 1.5, possessionPct: 45, golesFor: 0,
    rawMetrics: {
      goles_recibidos: 1, seleccionar_esquema: '4-2-3-1',
      'duelos_/_ganados_3': 48, 'duelos_aereos_/_ganados_3': 45, 'pases_/_logrados_3': 74,
      faltas: 14, tarjetas_amarillas: 3, tarjetas_rojas: 1, ppda: 9,
      'tiros_/_a_la_porteria': 9, 'tiros_en_contra_/_a_la_porteria': 11,
    },
    rivalRawMetrics: { 'pases_/_logrados_3': 78, ppda: 8 },
  }),
  match({
    fecha: '2026-02-23', xgFor: 1, xgAgainst: 1, possessionPct: 50, golesFor: 1,
    rawMetrics: {
      goles_recibidos: 1, seleccionar_esquema: '4-4-2',
      'duelos_/_ganados_3': 50, 'duelos_aereos_/_ganados_3': 52, 'pases_/_logrados_3': 77,
      faltas: 11, tarjetas_amarillas: 1, tarjetas_rojas: 0, ppda: 8.5,
      'tiros_/_a_la_porteria': 10, 'tiros_en_contra_/_a_la_porteria': 10,
    },
    rivalRawMetrics: { 'pases_/_logrados_3': 77, ppda: 8.5 },
  }),
]

describe('computeRecord', () => {
  it('cuenta victorias/empates/derrotas por diferencia de goles (golesFor vs. rawMetrics.goles_recibidos) y calcula PPG/efectividad', () => {
    const r = computeRecord(fixture)
    expect(r).toEqual({
      pj: 3, ganados: 1, empatados: 1, perdidos: 1,
      ppg: (3 + 1 + 0) / 3, gf: 3, gc: 3,
      efectividadPct: ((3 + 1) / 9) * 100,
    })
  })
})

describe('computeComparativa', () => {
  it('posesion y duelos usan la aproximacion 100-propio para el rival (zero-sum, mismo criterio que CoachTeamVsRivalCharts)', () => {
    const c = computeComparativa(fixture)
    const posesion = c.find(m => m.key === 'posesion')!
    expect(posesion.ownValue).toBeCloseTo((60 + 45 + 50) / 3, 5)
    expect(posesion.rivalValue).toBeCloseTo(100 - (60 + 45 + 50) / 3, 5)
    const duelos = c.find(m => m.key === 'duelos')!
    expect(duelos.ownValue).toBeCloseTo((55 + 48 + 50) / 3, 5)
    expect(duelos.rivalValue).toBeCloseTo(100 - (55 + 48 + 50) / 3, 5)
  })

  it('precision de pase y ppda leen el valor real del rival desde rivalRawMetrics, no una aproximacion', () => {
    const c = computeComparativa(fixture)
    const precision = c.find(m => m.key === 'precisionPase')!
    expect(precision.ownValue).toBeCloseTo((80 + 74 + 77) / 3, 5)
    expect(precision.rivalValue).toBeCloseTo((75 + 78 + 77) / 3, 5)
    const ppda = c.find(m => m.key === 'ppda')!
    expect(ppda.ownValue).toBeCloseTo((8 + 9 + 8.5) / 3, 5)
    expect(ppda.rivalValue).toBeCloseTo((10 + 8 + 8.5) / 3, 5)
  })

  it('xg usa xgFor/xgAgainst tipados, tiros usa tiros propios/en contra de la misma fila', () => {
    const c = computeComparativa(fixture)
    const xg = c.find(m => m.key === 'xg')!
    expect(xg.ownValue).toBeCloseTo((2 + 0.5 + 1) / 3, 5)
    expect(xg.rivalValue).toBeCloseTo((1 + 1.5 + 1) / 3, 5)
    const tiros = c.find(m => m.key === 'tirosTotales')!
    expect(tiros.ownValue).toBeCloseTo((12 + 9 + 10) / 3, 5)
    expect(tiros.rivalValue).toBeCloseTo((8 + 11 + 10) / 3, 5)
  })

  it('todas las metricas de "metrica" no vienen marcadas como editadas, y las de vias de generacion estan categorizadas aparte', () => {
    const c = computeComparativa(fixture)
    expect(c.every(m => m.overridden === false)).toBe(true)
    expect(c.filter(m => m.category === 'metrica').length).toBeGreaterThan(0)
    const viaGeneracion = c.filter(m => m.category === 'via_generacion')
    expect(viaGeneracion.length).toBe(7)
    expect(viaGeneracion.every(m => m.ownValue === 0 && m.rivalValue === 0)).toBe(true) // el fixture no tiene esas keys cargadas para las vias de generacion, deben devolver 0 sin romper
  })
})

describe('computeSistemas', () => {
  it('cuenta partidos por formación, orden descendente', () => {
    expect(computeSistemas(fixture)).toEqual([
      { formacion: '4-2-3-1', partidos: 2 },
      { formacion: '4-4-2', partidos: 1 },
    ])
  })
})

describe('computeDisciplina', () => {
  it('promedia faltas propias y suma tarjetas; faltas del rival viene de rivalRawMetrics', () => {
    const withRivalFaltas = fixture.map(m => ({ ...m, rivalRawMetrics: { ...m.rivalRawMetrics, faltas: 11 } }))
    const d = computeDisciplina(withRivalFaltas)
    expect(d.faltasPorPartido).toBeCloseTo((10 + 14 + 11) / 3, 5)
    expect(d.amarillas).toBe(6)
    expect(d.rojas).toBe(1)
    expect(d.faltasRivalPorPartido).toBeCloseTo(11, 5)
  })
})

describe('computeFormaReciente', () => {
  it('devuelve resultado y puntos acumulados en orden cronológico, limitado a n', () => {
    const f = computeFormaReciente(fixture, 2)
    expect(f.map(x => x.resultado)).toEqual(['D', 'E'])
    expect(f[1].puntosAcumulados).toBe(1)
  })
})
