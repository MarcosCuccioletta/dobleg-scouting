import { extractXlsxTable } from './extractXlsxTable'
import { buildXlsxTable } from './buildXlsxTable'
import { buildParseResult, type BuildParseResultOptions } from './buildParseResult'
import { GpsParseError } from './parsePdf'
import type { GpsParseResult } from '../types'

/**
 * Archivo Excel (tabla multi-jugador, ver `extractXlsxTable`) → propuesta de carga.
 * No persiste nada: la UI muestra el resultado, el usuario corrige y recién ahí se guarda.
 */
export async function parseGpsXlsx(data: ArrayBuffer, opts: BuildParseResultOptions): Promise<GpsParseResult> {
  let grid
  try {
    grid = await extractXlsxTable(data)
  } catch (err) {
    throw new GpsParseError(`No se pudo leer el Excel: ${(err as Error).message}`)
  }
  if (!grid) {
    throw new GpsParseError('No encontré una tabla de jugadores en el Excel.')
  }

  const table = buildXlsxTable(grid)
  return buildParseResult(table, opts)
}
