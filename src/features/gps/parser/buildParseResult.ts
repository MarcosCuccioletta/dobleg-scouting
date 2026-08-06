import { mapColumns } from './mapColumns'
import { inferContext } from './inferContext'
import { matchRosterName } from './matchPlayers'
import type { AgencyPlayer } from '@/constants/agencyPlayers'
import type { GpsParseResult, DetectedPlayer, PdfTable } from '../types'

export interface BuildParseResultOptions {
  roster: AgencyPlayer[]
  /** alias normalizado → key de métrica (ver `buildAliasLookup`). */
  lookup: Record<string, string>
  today?: Date
}

/** Tabla ya reconstruida (de un PDF o de un Excel) → propuesta de carga revisable. */
export function buildParseResult(table: PdfTable, opts: BuildParseResultOptions): GpsParseResult {
  const columns = mapColumns(table.headers, opts.lookup)
  const context = inferContext(table.preambleLines, opts.today ?? new Date())

  // Se guardan también las filas sin match (candidates: []): la revisión las muestra
  // aparte para que el usuario pueda asignarles un jugador Doble G a mano si el
  // matching automático no reconoció el nombre (variante, apodo, etc).
  const players: DetectedPlayer[] = table.rows.map(row => ({
    rawName: row.name,
    candidates: matchRosterName(row.name, opts.roster),
    values: row.values,
  }))

  return { table, context, columns, players }
}
