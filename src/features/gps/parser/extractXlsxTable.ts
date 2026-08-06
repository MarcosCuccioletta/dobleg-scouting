import { normalizeLabel } from './normalize'
import type { XlsxGrid } from './buildXlsxTable'

/**
 * Lee la primera hoja tabular del Excel. Los reportes de Catapult/GPS traen una
 * hoja "TOTAL" (partido completo) y a veces "PT"/"ST" (por tiempo) — se prioriza
 * TOTAL porque es la que corresponde a una carga de partido completo; si no existe
 * se usa la primera hoja del libro.
 */
export async function extractXlsxTable(data: ArrayBuffer): Promise<XlsxGrid | null> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(data, { type: 'array' })

  const sheetName = workbook.SheetNames.find(n => normalizeLabel(n) === 'total') ?? workbook.SheetNames[0]
  if (!sheetName) return null

  const sheet = workbook.Sheets[sheetName]
  // defval evita arrays con huecos en las celdas vacías (el primer header, sin
  // texto, quedaría `undefined` y .map() salta los huecos en vez de mapearlos).
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: false, defval: '' })
  if (grid.length < 2) return null

  const headers = (grid[0] as unknown[]).map(h => String(h ?? '').replace(/\s+/g, ' ').trim())
  const rows = grid.slice(1) as (string | number)[][]
  return { headers, rows }
}
