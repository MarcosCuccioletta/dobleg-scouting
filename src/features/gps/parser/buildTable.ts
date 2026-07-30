import { parseNumber, normalizeLabel } from './normalize'
import type { PdfTextItem, PdfRow, PdfCell, PdfTable, PdfTableRow } from '../types'

/** Dos textos con menos de esta diferencia de línea de base son la misma fila. */
const ROW_TOLERANCE = 3

/** Mínimo de valores numéricos para considerar que una fila es de datos. */
const MIN_NUMERIC_CELLS = 3

const HEADER_RE = /^(futbolista|jugador|player|nombre)$/
const AGGREGATE_RE = /^(%|sumatoria|total|promedio|equipo|valor|[12]\s*(er|do|°)?\s*tiempo)/

function toCell(item: PdfTextItem): PdfCell {
  return { text: item.str, x: item.x, width: item.width, center: item.x + item.width / 2 }
}

/** Agrupa los items en filas por línea de base, de arriba hacia abajo. */
export function groupRows(items: PdfTextItem[]): PdfRow[] {
  const sorted = [...items].sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x))
  const rows: PdfRow[] = []
  for (const it of sorted) {
    const last = rows[rows.length - 1]
    if (last && last.page === it.page && Math.abs(last.y - it.y) <= ROW_TOLERANCE) {
      last.cells.push(toCell(it))
    } else {
      rows.push({ page: it.page, y: it.y, cells: [toCell(it)] })
    }
  }
  for (const row of rows) row.cells.sort((a, b) => a.x - b.x)
  return rows
}

/** True si la fila es un promedio/subtotal del PDF y no un jugador. */
export function isAggregateRow(name: string): boolean {
  return AGGREGATE_RE.test(normalizeLabel(name))
}

function nearestColumn(centers: number[], center: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < centers.length; i++) {
    const dist = Math.abs(centers[i] - center)
    if (dist < bestDist) { bestDist = dist; best = i }
  }
  return best
}

/**
 * Reconstruye la tabla a partir de las filas. La cabecera es la primera fila con una
 * celda "Futbolista"/"Jugador"; cada valor se asigna a la columna cuyo centro está más
 * cerca, que es estable aunque las cabeceras estén alineadas a la izquierda y los
 * números a la derecha.
 */
export function buildTable(rows: PdfRow[]): PdfTable | null {
  // La cabecera necesita al menos una columna de métrica además del nombre: un
  // reporte "individual" (una tarjeta por jugador, sin tabla) puede tener una celda
  // suelta "JUGADOR" que matchea el label pero no es cabecera de nada.
  const headerIndex = rows.findIndex(r =>
    r.cells.length >= 2 && r.cells.some(c => HEADER_RE.test(normalizeLabel(c.text))))
  if (headerIndex < 0) return null

  const headerRow = rows[headerIndex]
  const headers = headerRow.cells.map(c => c.text)
  const centers = headerRow.cells.map(c => c.center)

  const preambleLines = rows
    .slice(0, headerIndex)
    .map(r => r.cells.map(c => c.text).join(' ').trim())
    .filter(Boolean)

  const dataRows: PdfTableRow[] = []
  for (const row of rows.slice(headerIndex + 1)) {
    const first = row.cells[0]
    if (!first) continue
    if (parseNumber(first.text) !== null) continue   // fila de valores sin nombre
    if (isAggregateRow(first.text)) continue

    const values: (number | null)[] = new Array(headers.length).fill(null)
    let numeric = 0
    for (const cell of row.cells.slice(1)) {
      const n = parseNumber(cell.text)
      if (n === null) continue
      const col = nearestColumn(centers, cell.center)
      if (col === 0) continue
      values[col] = n
      numeric++
    }
    if (numeric < MIN_NUMERIC_CELLS) continue

    dataRows.push({ name: first.text, values })
  }

  return { headers, rows: dataRows, preambleLines }
}
