import { POSITION_MAP } from '@/constants/scoring'
import type { RawExternalPlayer, RawInternalPlayer, EnrichedPlayer } from '@/types'
import type { Currency } from '@/context/CurrencyContext'



// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function parseMarketValue(raw: string): number {
  if (!raw || raw === '-' || raw === '') return 0

  const str = raw.trim().toLowerCase()

  // Handle Spanish format: "900 mil €", "1,5 mill €"
  const milMatch = str.match(/([\d.,]+)\s*mil+\s*€?/i)
  if (milMatch) {
    const numStr = milMatch[1].replace(',', '.')
    const num = parseFloat(numStr)
    if (!isNaN(num)) return num * 1_000
  }

  // Handle Transfermarkt format: €200k, €2.80m, €1.5M, etc.
  // Match patterns like: €200k, €2.80m, 500k, 1.5m
  const match = str.match(/[€$]?\s*([\d.,]+)\s*(k|m)?/i)
  if (match) {
    const numStr = match[1].replace(',', '.')
    const num = parseFloat(numStr)
    if (isNaN(num)) return 0

    const suffix = match[2]?.toLowerCase()
    if (suffix === 'm') return num * 1_000_000
    if (suffix === 'k') return num * 1_000
    return num
  }

  // Fallback: remove currency symbols and parse
  const cleaned = raw.replace(/[€$\s]/g, '').replace(/\./g, '').replace(/,/g, '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function formatMarketValue(value: number): string {
  if (!value || value === 0) return '-'
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€' }

export function formatMarketValueInCurrency(valueEUR: number, currency: Currency, rate: number): string {
  if (!valueEUR || valueEUR === 0) return '-'
  const value = currency === 'USD' ? valueEUR * rate : valueEUR
  const symbol = CURRENCY_SYMBOL[currency]
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${symbol}${Math.round(value / 1_000)}K`
  return `${symbol}${Math.round(value)}`
}

export function parseContractDate(raw: string): Date | null {
  if (!raw || raw === '-' || raw === '') return null
  // Try DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]))
  }
  // Try YYYY-MM-DD
  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (yyyymmdd) {
    return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]))
  }
  return null
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function getNumericValue(player: Record<string, string>, column: string): number {
  const raw = player[column] ?? ''
  if (!raw || raw === '-') return 0
  const num = parseFloat(raw.replace(',', '.'))
  return isNaN(num) ? 0 : num
}

export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────────

function enrichPlayer(
  player: Record<string, string>,
  rating: number | null,
  ratingPercentile: number | null,
  source: 'externo' | 'interno'
): EnrichedPlayer {
  // Try multiple column names for market value (different CSV formats)
  const rawValue = player['Valor de mercado (Transfermarkt)'] || player['Valor de mercado'] || ''
  const marketValueRaw = parseMarketValue(rawValue)

  // Try multiple column names for contract date
  const contractStr = player['Vencimiento contrato'] || player['Fecha fin de contrato'] || ''
  const contractDate = parseContractDate(contractStr)
  const now = new Date()
  const monthsRemaining = contractDate ? monthsBetween(now, contractDate) : null

  // For internal players, use "Posición específica" as main position
  const posEspecifica = player['Posición específica'] ?? ''
  const posGeneral = player['Posición'] ?? ''

  return {
    Jugador: player['Jugador'] ?? '',
    Liga: player['Liga'] ?? '',
    Equipo: player['Equipo'] ?? '',
    'Posición': posEspecifica || posGeneral,
    Edad: player['Edad'] ?? '',
    'País de nacimiento': player['País de nacimiento'] ?? '',
    Pie: player['Pie'] ?? '',
    Altura: player['Altura'] ?? '',
    'Valor de mercado (Transfermarkt)': rawValue,
    'Vencimiento contrato': contractStr,
    'Partidos jugados': player['Partidos jugados'] ?? '',
    'Minutos jugados': player['Minutos jugados'] ?? '',
    Goles: player['Goles'] ?? '',
    xG: player['xG'] ?? '',
    Asistencias: player['Asistencias'] ?? '',
    xA: player['xA'] ?? '',
    'Posición específica': player['Posición específica'] ?? '',
    id: player['id'] ?? '',
    Transfermkt: player['Transfermkt'] ?? '',
    Representante: player['Representante'] ?? '',
    Imagen: player['Imagen'] ?? '',
    rating,
    ratingPercentile,
    source,
    contractStatus:
      monthsRemaining === null ? 'ok'
      : monthsRemaining < 7   ? 'critical'
      : monthsRemaining < 13  ? 'warning'
      : 'ok',
    monthsRemaining,
    marketValueRaw,
    minutesPlayed: getNumericValue(player, 'Minutos jugados'),
    ageNum: parseInt(player['Edad'] ?? '0', 10) || 0,
    // Spread all raw columns for stat access
    ...player,
  }
}



/** Lo mínimo que `applyRating` necesita de una entrada del lookup de la API. */
export interface RatingEntry {
  score: number | null
  percentile: number | null
}

/**
 * Asigna a cada jugador del CSV el Rating (1-10) que ya calculó la API
 * (promedio de rating de Sofascore/API-Football por temporada), buscándolo
 * por nombre normalizado.
 *
 * Reemplaza al scoring ponderado propio ("Score GG") que combinaba métricas
 * con pesos elegidos a criterio propio — ver
 * docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md. Si
 * un jugador no está en la API queda en null: preferimos que la ficha diga
 * que no hay rating antes que mostrar un número de otra fuente.
 */
export function applyRating(
  players: (RawExternalPlayer | RawInternalPlayer)[],
  source: 'externo' | 'interno',
  lookup: Map<string, RatingEntry>
): EnrichedPlayer[] {
  return players.map(player => {
    const entry = lookup.get(normalizeName(player['Jugador'] ?? ''))
    return enrichPlayer(
      player as Record<string, string>,
      entry?.score ?? null,
      entry?.percentile ?? null,
      source
    )
  })
}

// ─── NORMALIZATION FOR RADAR (internal players) ───────────────────────────────

export interface PositionMinMax {
  [column: string]: { min: number; max: number }
}

export function computePositionMinMax(
  players: EnrichedPlayer[],
  posKey: string,
  metrics: string[]
): PositionMinMax {
  const posPlayers = players.filter(p => {
    const rawPos = (p['Posición específica'] || p['Posición'])?.trim() ?? ''
    const pk = POSITION_MAP[rawPos] ?? ''
    return pk === posKey
  })

  const result: PositionMinMax = {}
  for (const metric of metrics) {
    const values = posPlayers.map(p => {
      const v = p[metric]
      if (typeof v === 'number') return v
      const num = parseFloat(String(v ?? '').replace(',', '.'))
      return isNaN(num) ? 0 : num
    })
    result[metric] = {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
    }
  }
  return result
}
