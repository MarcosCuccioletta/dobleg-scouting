import { describe, it, expect } from 'vitest'
import { distinctValues, toLegacyGpsEntry } from './gpsService'
import type { GpsEntryRow, GpsMetric } from '@/features/gps/types'

const metrics: GpsMetric[] = [
  { id: 1, key: 'distancia_total', label: 'Distancia Total', unit: 'm', decimals: 0, category: 'locomotor', sort_order: 10, is_active: true },
  { id: 2, key: 'vel_max', label: 'Vel Máx', unit: 'km/h', decimals: 1, category: 'locomotor', sort_order: 70, is_active: true },
]

const row = (over: Partial<GpsEntryRow> = {}): GpsEntryRow => ({
  id: 'a', player_key: 'gonzalo gonzalez', player_name: 'Gonzalo González',
  match_date: '2026-07-25', equipo: 'Estudiantes RC', rival: 'Tigre',
  competencia: 'Primera Nacional', resultado: null, minutos: 98,
  metrics: { distancia_total: 10222, vel_max: 30.8 }, source: 'pdf',
  file_name: null, created_by: null, created_by_name: null,
  created_at: '', updated_at: '', ...over,
})

describe('distinctValues', () => {
  it('devuelve los valores usados, sin repetir ni vacíos, ordenados', () => {
    const rows = [row(), row({ rival: 'Ajax' }), row({ rival: 'Tigre' }), row({ rival: null })]
    expect(distinctValues(rows, 'rival')).toEqual(['Ajax', 'Tigre'])
  })
})

describe('toLegacyGpsEntry', () => {
  it('mapea el jsonb a la forma vieja que consumen los informes', () => {
    const legacy = toLegacyGpsEntry(row(), metrics)
    expect(legacy.Jugador).toBe('Gonzalo González')
    expect(legacy.Fecha.toISOString().slice(0, 10)).toBe('2026-07-25')
    expect(legacy.Distancia).toBe(10222)
    expect(legacy.VelMax).toBe(30.8)
    expect(legacy.Minutos).toBe(98)
    expect(legacy.HSR).toBe(0)          // sin dato → 0, como el Sheet viejo
  })
})
