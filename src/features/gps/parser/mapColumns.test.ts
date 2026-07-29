import { describe, it, expect } from 'vitest'
import { buildAliasLookup, mapColumns, MINUTES_KEY } from './mapColumns'
import type { GpsMetric, GpsMetricAlias } from '../types'

const metrics: GpsMetric[] = [
  { id: 1, key: 'distancia_total', label: 'Distancia Total', unit: 'm', decimals: 0, category: 'locomotor', sort_order: 10, is_active: true },
  { id: 2, key: 'metros_por_min', label: 'Mts/min', unit: 'm/min', decimals: 1, category: 'locomotor', sort_order: 20, is_active: true },
  { id: 3, key: 'vel_max', label: 'Vel Máx', unit: 'km/h', decimals: 1, category: 'locomotor', sort_order: 70, is_active: true },
]

const aliases: GpsMetricAlias[] = [
  { id: 1, metric_id: 1, alias: 'distancia', source: null },
  { id: 2, metric_id: 2, alias: 'dist rel x min', source: 'estudiantes' },
  { id: 3, metric_id: 3, alias: 'v max', source: 'estudiantes' },
]

const lookup = buildAliasLookup(metrics, aliases)

describe('buildAliasLookup', () => {
  it('indexa por label, por key y por alias, todo normalizado', () => {
    expect(lookup['distancia total']).toBe('distancia_total')
    expect(lookup['distancia_total']).toBe('distancia_total')
    expect(lookup['distancia']).toBe('distancia_total')
    expect(lookup['vel max']).toBe('vel_max')
  })
})

describe('mapColumns', () => {
  const headers = ['Futbolista', 'T', 'Distancia', 'Dist Rel x Min', 'V Max', 'Dist Acele']

  it('marca la primera columna como nombre', () => {
    expect(mapColumns(headers, lookup)[0]).toEqual({ header: 'Futbolista', index: 0, metricKey: null, role: 'name' })
  })

  it('reconoce la columna de minutos', () => {
    const t = mapColumns(headers, lookup)[1]
    expect(t.role).toBe('minutes')
    expect(t.metricKey).toBe(MINUTES_KEY)
  })

  it('resuelve las métricas conocidas por alias', () => {
    const cols = mapColumns(headers, lookup)
    expect(cols[2]).toMatchObject({ metricKey: 'distancia_total', role: 'metric' })
    expect(cols[3]).toMatchObject({ metricKey: 'metros_por_min', role: 'metric' })
    expect(cols[4]).toMatchObject({ metricKey: 'vel_max', role: 'metric' })
  })

  it('deja sin resolver lo que no conoce', () => {
    expect(mapColumns(headers, lookup)[5]).toEqual({ header: 'Dist Acele', index: 5, metricKey: null, role: 'unmapped' })
  })
})
