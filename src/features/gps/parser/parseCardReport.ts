import { parseNumber, parseDuration } from './normalize'
import type { PdfRow, PdfTable, PdfTableRow } from '../types'

/** Mínimo de tarjetas lado a lado para contar como bloque de métricas y no texto suelto. */
const MIN_BLOCK_CELLS = 2

function cellNumber(text: string): number | null {
  const n = parseNumber(text)
  return n !== null ? n : parseDuration(text)
}

function isLabelRow(row: PdfRow): boolean {
  return row.cells.length >= MIN_BLOCK_CELLS && row.cells.every(c => cellNumber(c.text) === null)
}

function isValueRow(row: PdfRow, width: number): boolean {
  return row.cells.length === width && row.cells.every(c => cellNumber(c.text) !== null)
}

/**
 * Reconstruye una tabla de una sola fila a partir de un reporte "individual" (una
 * tarjeta por métrica: título, valor, código técnico y nombre repetido — como los PDFs
 * "OpenField de Atleta" de Catapult). No hay tabla de la que deducir el jugador: lo
 * elige el usuario antes de cargar el archivo, y acá se usa tal cual.
 *
 * El reconocimiento es greedy: cualquier fila seguida de otra con la misma cantidad de
 * celdas, todas numéricas, es un bloque título+valor. Lo demás (código técnico, nombre
 * repetido, encabezados, pie de página) no hace falta reconocerlo explícitamente: al no
 * calzar como par título+valor, cae como línea de contexto y no rompe el escaneo del
 * bloque siguiente.
 */
export function buildCardTable(rows: PdfRow[], playerName: string): PdfTable | null {
  // Índice 0 reservado para la columna de nombre, igual que en `buildTable`: el resto
  // del pipeline (mapColumns, ParseReviewPanel) asume esa convención y descarta ese
  // índice al mapear métricas.
  const headers: string[] = ['']
  const values: (number | null)[] = [null]
  const contextLines: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const title = rows[i]
    const value = rows[i + 1]
    if (value && isLabelRow(title) && isValueRow(value, title.cells.length)) {
      for (let c = 0; c < title.cells.length; c++) {
        headers.push(title.cells[c].text)
        values.push(cellNumber(value.cells[c].text))
      }
      i++ // saltea también la fila de valores que se acaba de consumir
      continue
    }
    const text = title.cells.map(c => c.text).join(' ').trim()
    if (text) contextLines.push(text)
  }

  if (headers.length === 1) return null

  const row: PdfTableRow = { name: playerName, values }
  return { headers, rows: [row], preambleLines: contextLines }
}
