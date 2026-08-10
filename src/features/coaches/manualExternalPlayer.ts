import { POSITION_MAP } from '@/constants/scoring'
import { formatMarketValue, parseMarketValue } from '@/utils/scoring'
import type { EnrichedPlayer } from '@/types'
import type { ManualExternalPlayerRow } from '@/services/manualExternalPlayersService'

// Posicion generica que trae /players/squads de API-Football -> valor canonico
// de POSITION_MAP. Es una posicion "gruesa", no especifica -- se puede afinar
// despues a mano, igual que cualquier jugador recien scouteado sin detalle fino.
const SQUAD_POSITION_TO_SPANISH: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor Central',
  Midfielder: 'Volante central',
  Attacker: 'Delantero',
}

export function mapSquadPositionToSpanish(position: string | null): string {
  if (!position) return ''
  return SQUAD_POSITION_TO_SPANISH[position] ?? ''
}

/** Ficha minima de Externo a partir de una fila creada al vuelo desde un plantel. */
export function manualExternalToEnriched(row: ManualExternalPlayerRow, ggScore: number | null): EnrichedPlayer {
  const position = POSITION_MAP[row.position] ?? row.position
  const marketValueRaw = parseMarketValue('')
  return {
    Jugador: row.full_name,
    Liga: '',
    Equipo: row.team,
    'Posición': position,
    Edad: row.age != null ? String(row.age) : '',
    'País de nacimiento': '',
    Pie: '',
    Altura: '',
    'Valor de mercado (Transfermarkt)': '',
    'Vencimiento contrato': '',
    'Partidos jugados': '',
    'Minutos jugados': '',
    Goles: '',
    xG: '',
    Asistencias: '',
    xA: '',
    'Posición específica': position,
    id: '',
    Transfermkt: '',
    Representante: '',
    Imagen: row.photo ?? '',
    ggScore,
    ggScorePercentile: null,
    source: 'externo',
    contractStatus: 'ok',
    monthsRemaining: null,
    marketValueFormatted: formatMarketValue(marketValueRaw),
    marketValueRaw,
    minutesPlayed: 0,
    ageNum: row.age ?? 0,
  }
}
