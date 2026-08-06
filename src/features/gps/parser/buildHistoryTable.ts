import { normalizeLabel, parseNumber } from './normalize'
import type { HtmlTable, HistoryColumnMapping, HistoryMatchRow, HistoryParseResult } from '../types'

const DATE_ALIASES = new Set(['fecha', 'date', 'dia', 'día'])
const RIVAL_ALIASES = new Set(['rival', 'oponente', 'opponent', 'visitante', 'contrincante'])
const COMPETENCIA_ALIASES = new Set(['competencia', 'torneo', 'liga', 'competition', 'campeonato'])
const MINUTES_ALIASES = new Set(['t', 'min', 'mins', 'minutos', 'minutos jugados', 'tiempo', 'minutes', 'mp'])

/**
 * Cabecera → rol. No reusa `mapColumns` de la tabla multi-jugador porque esa función
 * asume que la columna 0 es un nombre de jugador, algo que acá no existe (cada fila
 * es un partido, no un jugador).
 */
export function classifyHistoryColumns(headers: string[], lookup: Record<string, string>): HistoryColumnMapping[] {
  return headers.map((header, index) => {
    const norm = normalizeLabel(header)
    if (DATE_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'date' as const }
    if (RIVAL_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'rival' as const }
    if (COMPETENCIA_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'competencia' as const }
    if (MINUTES_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'minutes' as const }
    const key = lookup[norm]
    return key
      ? { header, index, metricKey: key, role: 'metric' as const }
      : { header, index, metricKey: null, role: 'unmapped' as const }
  })
}

/** "30/01/26" | "30/01/2026" | "2026-01-30" → 'YYYY-MM-DD'. null si no matchea. */
export function parseHistoryDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!dmy) return null
  const [, d, m, y] = dmy
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Arma los "partidos detectados" a partir de una tabla con forma historial (fila =
 * partido de UN jugador). El orden de `table.rows` se conserva: en los reportes
 * reales coincide con el orden cronológico real aunque no traigan fecha de calendario
 * (caso Loyola).
 */
export function buildHistoryTable(table: HtmlTable, lookup: Record<string, string>): HistoryParseResult {
  const columns = classifyHistoryColumns(table.headers, lookup)
  const dateCol = columns.find(c => c.role === 'date')
  const rivalCol = columns.find(c => c.role === 'rival')
  const competenciaCol = columns.find(c => c.role === 'competencia')
  const minutosCol = columns.find(c => c.role === 'minutes')

  const matches: HistoryMatchRow[] = table.rows.map(row => ({
    rawCells: row,
    matchDate: dateCol ? parseHistoryDate(row[dateCol.index] ?? '') : null,
    rival: rivalCol ? (row[rivalCol.index] ?? '').trim() : '',
    competencia: competenciaCol ? ((row[competenciaCol.index] ?? '').trim() || null) : null,
    minutos: minutosCol ? parseNumber(row[minutosCol.index]) : null,
    values: row.map(cell => parseNumber(cell)),
  }))

  return { columns, matches }
}
