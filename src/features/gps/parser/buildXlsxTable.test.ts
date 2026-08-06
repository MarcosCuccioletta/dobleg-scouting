import { describe, it, expect } from 'vitest'
import { buildXlsxTable } from './buildXlsxTable'

describe('buildXlsxTable', () => {
  it('arma la tabla a partir de la cabecera y las filas de datos', () => {
    const table = buildXlsxTable({
      headers: ['', 'Tot Dur', 'Distancia Mts (m)', 'Max Vel (km/h)'],
      rows: [
        ['Nicolas Watson', 70, 8135, 27],
        ['Ignacio Gariglio', 95, 9776, 30],
      ],
    })

    expect(table.headers).toEqual(['', 'Tot Dur', 'Distancia Mts (m)', 'Max Vel (km/h)'])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0]).toEqual({ name: 'Nicolas Watson', values: [null, 70, 8135, 27] })
    expect(table.preambleLines).toEqual([])
  })

  it('descarta la fila de Promedio', () => {
    const table = buildXlsxTable({
      headers: ['', 'Distancia Mts (m)'],
      rows: [
        ['Nicolas Sansotre', 4767],
        ['Promedio', 4829],
      ],
    })

    expect(table.rows.map(r => r.name)).toEqual(['Nicolas Sansotre'])
  })

  it('descarta filas en blanco', () => {
    const table = buildXlsxTable({
      headers: ['', 'Distancia Mts (m)'],
      rows: [
        ['Nicolas Sansotre', 4767],
        ['', ''],
      ],
    })

    expect(table.rows.map(r => r.name)).toEqual(['Nicolas Sansotre'])
  })

  it('acepta celdas numéricas con coma decimal como texto', () => {
    const table = buildXlsxTable({
      headers: ['', 'Max Vel (km/h)'],
      rows: [['Nicolas Watson', '27,3']],
    })

    expect(table.rows[0].values).toEqual([null, 27.3])
  })
})
