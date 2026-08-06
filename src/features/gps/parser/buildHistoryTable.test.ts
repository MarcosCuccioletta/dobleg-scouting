import { describe, it, expect } from 'vitest'
import { buildHistoryTable, classifyHistoryColumns, parseHistoryDate } from './buildHistoryTable'
import type { HtmlTable } from '../types'

describe('parseHistoryDate', () => {
  it('acepta dd/mm/aa, dd/mm/aaaa e ISO', () => {
    expect(parseHistoryDate('30/01/26')).toBe('2026-01-30')
    expect(parseHistoryDate('30/01/2026')).toBe('2026-01-30')
    expect(parseHistoryDate('2026-01-30')).toBe('2026-01-30')
  })

  it('devuelve null si no matchea ningún formato', () => {
    expect(parseHistoryDate('Fecha 2 TC')).toBeNull()
    expect(parseHistoryDate('')).toBeNull()
  })
})

describe('classifyHistoryColumns', () => {
  it('reconoce fecha, rival, competencia y minutos por alias fijo', () => {
    const columns = classifyHistoryColumns(
      ['Fecha', 'Rival', 'Competencia', 'Minutos', 'Distancia'],
      { distancia: 'distancia_total' },
    )
    expect(columns.map(c => c.role)).toEqual(['date', 'rival', 'competencia', 'minutes', 'metric'])
    expect(columns[4].metricKey).toBe('distancia_total')
  })

  it('sin columna de fecha, esa fila queda sin rol "date"', () => {
    const columns = classifyHistoryColumns(['Rival', 'Torneo', 'Minutos'], {})
    expect(columns.map(c => c.role)).toEqual(['rival', 'competencia', 'minutes'])
  })

  it('columna desconocida contra el catálogo queda "unmapped"', () => {
    const columns = classifyHistoryColumns(['Dist Acele'], {})
    expect(columns[0].role).toBe('unmapped')
  })
})

describe('buildHistoryTable', () => {
  const lookup = { 'dist. total (m)': 'distancia_total', 'vel. max (km/h)': 'vel_max' }

  it('caso Loyola: sin columna de fecha, matchDate queda null en todas las filas', () => {
    const table: HtmlTable = {
      headers: ['#', 'Rival', 'Torneo', 'Minutos', 'Dist. Total (m)', 'Vel. Max (km/h)'],
      rows: [
        ['1', 'U. DE CHILE', 'TORNEO NACIONAL', '14', '1617', '28.8'],
        ['2', 'ÑUBLENSE', 'TORNEO NACIONAL', '21', '2400', '27.3'],
      ],
    }
    const result = buildHistoryTable(table, lookup)
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].matchDate).toBeNull()
    expect(result.matches[0].rival).toBe('U. DE CHILE')
    expect(result.matches[0].competencia).toBe('TORNEO NACIONAL')
    expect(result.matches[0].minutos).toBe(14)
    // values alineado con columns por índice: índice 4 = Dist. Total (m).
    expect(result.matches[0].values[4]).toBe(1617)
    expect(result.matches[1].rival).toBe('ÑUBLENSE')
  })

  it('con columna de fecha, la parsea; preserva el orden de las filas', () => {
    const table: HtmlTable = {
      headers: ['Fecha', 'Rival', 'Dist. Total (m)'],
      rows: [
        ['30/01/2026', 'A', '1000'],
        ['15/02/2026', 'B', '2000'],
      ],
    }
    const result = buildHistoryTable(table, lookup)
    expect(result.matches.map(m => m.matchDate)).toEqual(['2026-01-30', '2026-02-15'])
    expect(result.matches.map(m => m.rival)).toEqual(['A', 'B'])
  })
})
