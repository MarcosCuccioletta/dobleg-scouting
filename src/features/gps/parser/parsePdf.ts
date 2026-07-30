import { extractPdfItems } from './extractItems'
import { groupRows, buildTable } from './buildTable'
import { buildCardTable } from './parseCardReport'
import { mapColumns } from './mapColumns'
import { inferContext } from './inferContext'
import { matchRosterName } from './matchPlayers'
import type { AgencyPlayer } from '@/constants/agencyPlayers'
import type { GpsParseResult, DetectedPlayer, PdfTextItem } from '../types'

export interface ParseOptions {
  roster: AgencyPlayer[]
  /** alias normalizado → key de métrica (ver `buildAliasLookup`). */
  lookup: Record<string, string>
  today?: Date
  workerSrc?: string
  /**
   * fullName del jugador elegido de antemano en la UI. Los reportes "individuales"
   * (una tarjeta por métrica, sin tabla) no traen de dónde deducir el jugador, así
   * que sin esto sólo se intenta la tabla multi-jugador.
   */
  presetPlayerName?: string
}

export class GpsParseError extends Error {}

/**
 * Archivo → propuesta de carga. No persiste nada: la UI muestra el resultado, el
 * usuario corrige y recién ahí se guarda.
 */
export async function parseGpsPdf(data: ArrayBuffer, opts: ParseOptions): Promise<GpsParseResult> {
  let items: PdfTextItem[]
  try {
    items = await extractPdfItems(data, { workerSrc: opts.workerSrc })
  } catch (err) {
    throw new GpsParseError(`No se pudo leer el PDF: ${(err as Error).message}`)
  }

  if (items.length === 0) {
    throw new GpsParseError('El PDF no tiene texto seleccionable. Si es una foto o un escaneo, cargalo a mano.')
  }

  const rows = groupRows(items)
  const table = buildTable(rows) ?? (opts.presetPlayerName ? buildCardTable(rows, opts.presetPlayerName) : null)
  if (!table) {
    throw new GpsParseError(
      opts.presetPlayerName
        ? 'No encontré una tabla ni tarjetas de métricas en el PDF. Revisá el archivo o cargalo a mano.'
        : 'No encontré una tabla de jugadores en el PDF. Si es un reporte individual de un solo jugador, elegilo arriba antes de cargar el archivo.',
    )
  }

  const columns = mapColumns(table.headers, opts.lookup)
  const context = inferContext(table.preambleLines, opts.today ?? new Date())

  const players: DetectedPlayer[] = []
  for (const row of table.rows) {
    const candidates = matchRosterName(row.name, opts.roster)
    if (candidates.length === 0) continue
    players.push({ rawName: row.name, candidates, values: row.values })
  }

  return { table, context, columns, players }
}
