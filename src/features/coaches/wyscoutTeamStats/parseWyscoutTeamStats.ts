import { normalizeForSearch } from '@/lib/search'

export interface WyscoutRawRow {
  fecha: string
  partido: string
  competencia: string
  equipo: string
  goles: number | null
  xg: number | null
  posesion: number | null
  extra: Record<string, number | string | null>
}

export interface WyscoutMatch {
  fecha: string
  partido: string
  competencia: string
  equipoPropio: string
  equipoRival: string
  xgFor: number | null
  xgAgainst: number | null
  possessionPct: number | null
  rawMetrics: Record<string, number | string | null>
}

// Columna 0=Fecha, 1=Partido, 2=Competicion, 4=Equipo, 6=Goles, 7=xG, 14=Posesion%.
// Layout fijo del export "Team Stats" de Wyscout (verificado contra un archivo real).
const COL_FECHA = 0
const COL_PARTIDO = 1
const COL_COMPETENCIA = 2
const COL_EQUIPO = 4
const COL_GOLES = 6
const COL_XG = 7
const COL_POSESION = 14

function toNumberOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function slugify(label: string): string {
  return normalizeForSearch(label).replace(/\s+/g, '_')
}

/** Fila 0 del sheet: forward-fill de headers agrupados (Wyscout deja vacia la celda de las columnas siguientes a la primera de cada grupo). */
function forwardFillHeaders(headerRow: unknown[]): string[] {
  const filled: string[] = []
  let last = ''
  const seen = new Map<string, number>()
  for (const cell of headerRow) {
    const raw = String(cell ?? '').trim()
    if (raw) last = raw
    const base = slugify(last || 'col')
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    filled.push(count > 1 ? `${base}_${count}` : base)
  }
  return filled
}

function rowToRaw(headers: string[], row: unknown[]): WyscoutRawRow {
  const extra: Record<string, number | string | null> = {}
  for (let i = 0; i < headers.length; i++) {
    if ([COL_FECHA, COL_PARTIDO, COL_COMPETENCIA, COL_EQUIPO, COL_GOLES, COL_XG, COL_POSESION].includes(i)) continue
    const v = row[i]
    extra[headers[i]] = v === '' || v === undefined ? null : (typeof v === 'number' ? v : String(v))
  }
  return {
    fecha: String(row[COL_FECHA] ?? ''),
    partido: String(row[COL_PARTIDO] ?? ''),
    competencia: String(row[COL_COMPETENCIA] ?? ''),
    equipo: String(row[COL_EQUIPO] ?? ''),
    goles: toNumberOrNull(row[COL_GOLES]),
    xg: toNumberOrNull(row[COL_XG]),
    posesion: toNumberOrNull(row[COL_POSESION]),
    extra,
  }
}

/** Agrupa filas (ya extraidas, una por equipo por partido) en pares y arma un WyscoutMatch por cada par que incluya al equipo propio. */
export function buildWyscoutMatches(rows: WyscoutRawRow[], ownTeamName: string): WyscoutMatch[] {
  const ownNormalized = normalizeForSearch(ownTeamName)
  const byKey = new Map<string, WyscoutRawRow[]>()
  for (const row of rows) {
    const key = `${row.fecha}__${row.partido}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(row)
  }

  const matches: WyscoutMatch[] = []
  for (const pair of byKey.values()) {
    const own = pair.find(r => normalizeForSearch(r.equipo) === ownNormalized)
    const rival = pair.find(r => normalizeForSearch(r.equipo) !== ownNormalized)
    if (!own || !rival) continue
    matches.push({
      fecha: own.fecha,
      partido: own.partido,
      competencia: own.competencia,
      equipoPropio: own.equipo,
      equipoRival: rival.equipo,
      xgFor: own.xg,
      xgAgainst: rival.xg,
      possessionPct: own.posesion,
      rawMetrics: own.extra,
    })
  }
  return matches
}

export async function parseWyscoutTeamStatsXlsx(data: ArrayBuffer, ownTeamName: string): Promise<WyscoutMatch[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (grid.length < 2) return []

  const headers = forwardFillHeaders(grid[0])
  const rows = grid.slice(1).filter(r => r[COL_FECHA]).map(r => rowToRaw(headers, r))
  return buildWyscoutMatches(rows, ownTeamName)
}
