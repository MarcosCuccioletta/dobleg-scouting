import { parseNumber } from './normalize'
import { isAggregateRow } from './buildTable'
import type { PdfTable, PdfTableRow } from '../types'

export interface XlsxGrid {
  headers: string[]
  rows: (string | number)[][]
}

/**
 * Arma la tabla a partir de una hoja de Excel ya tabular (fila 0 = cabecera,
 * resto = datos, columna 0 = nombre). A diferencia del PDF no hace falta
 * buscar dónde empieza la tabla: no hay texto suelto alrededor.
 */
export function buildXlsxTable(grid: XlsxGrid): PdfTable {
  const rows: PdfTableRow[] = []
  for (const row of grid.rows) {
    const name = String(row[0] ?? '').trim()
    if (!name || isAggregateRow(name)) continue

    const values: (number | null)[] = new Array(grid.headers.length).fill(null)
    for (let i = 1; i < grid.headers.length; i++) values[i] = parseNumber(row[i])

    rows.push({ name, values })
  }

  return { headers: grid.headers, rows, preambleLines: [] }
}
