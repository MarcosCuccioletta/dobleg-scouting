// ─── RAW CSV ROW TYPES ────────────────────────────────────────────────────────

export type RawRow = Record<string, string>

export interface RawPlayer {
  Jugador: string
  Equipo: string
  'Posición': string
  Edad: string
  'Valor de mercado (Transfermarkt)': string
  'Vencimiento contrato': string
  'Partidos jugados': string
  'Minutos jugados': string
  Goles: string
  xG: string
  Asistencias: string
  xA: string
  [key: string]: string
}

export interface RawExternalPlayer extends RawPlayer {
  Liga: string
  'País de nacimiento': string
  Pie: string
  Altura: string
}

export interface RawInternalPlayer extends RawPlayer {
  'Posición específica': string
  id: string
  Transfermkt: string
  'País de nacimiento': string
  Pie: string
  Altura: string
  Liga: string
}

// Management status for agency tracking
export type ManagementStatus = 'en_seguimiento' | 'contactado' | 'en_negociacion' | 'descartado'

export interface MonitoringPlayer {
  Jugador: string
  'Nombre jugador': string
  Club: string
  Liga: string
  Nacionalidad: string
  'Fecha de nacimiento': string
  Edad: string
  'Posición': string
  Rol: string
  Repre: string
  Datos: string
  'Ficha técnica': string
  // Links
  Transfermkt?: string
  WyscoutVideo?: string
  // Enriched from metrics data
  ggScore?: number | null
  hasEnoughData?: boolean  // true if player has sufficient metrics for scoring
  metricsPlayer?: EnrichedPlayer | null  // Player data from seguimientoMetricas sheet
  // Enriched from external data (legacy, for fallback)
  externalPlayer?: EnrichedPlayer | null
  // Computed fields
  opportunityScore?: number | null  // ggScore / marketValue ratio
  marketValueRaw?: number
  marketValueFormatted?: string
  monthsRemaining?: number | null
  contractStatus?: 'ok' | 'warning' | 'critical'
  // Comparison with internal players
  avgInternalScore?: number | null  // Average ggScore of internal players in same position
  scoreDiff?: number | null  // Difference from internal average
}

export interface TransfermarktData {
  Jugador: string
  nombre_tm: string
  equipo_csv: string
  liga_csv: string
  'Valor de mercado': string
  'Fin de contrato': string
  Representante: string
  Transfermkt: string
  Imagen: string
}

export interface NormalizedPlayer {
  Jugador: string
  Liga: string
  Equipo: string
  'Posición': string
  'Posición específica'?: string
  [key: string]: string | number | undefined
}

export interface EvolutionEntry {
  JugadorNombre: string
  JugadorSK: string
  PosicionSK: string
  PosicionGeneral: string
  Date: string
  Partido: string
  Competition: string
  Posicion_Principal: string
  Minutos_jugados: string
  imagen: string
  [key: string]: string
}

export interface SubjectiveMetric {
  JugadorSK: string
  'Nº Atributo': string
  Atributo: string
  'Tipo Atributo': string
  'Posicion Jugador': string
  numero: string
}

export interface MarketValueHistoryEntry {
  Jugador: string
  idTM: string
  fecha: Date
  valor: number
  equipo: string
  edad: number
}

// ─── ENRICHED PLAYER ─────────────────────────────────────────────────────────

export interface EnrichedPlayer {
  // Identity
  Jugador: string
  Liga: string
  Equipo: string
  'Posición': string
  Edad: string
  'País de nacimiento': string
  Pie: string
  Altura: string
  'Valor de mercado (Transfermarkt)': string
  'Vencimiento contrato': string
  'Partidos jugados': string
  'Minutos jugados': string
  Goles: string
  xG: string
  Asistencias: string
  xA: string
  // Internal-only fields (empty string for external)
  'Posición específica': string
  id: string
  Transfermkt: string
  // Transfermarkt enriched fields
  Representante: string
  Imagen: string
  // Enrichment
  ggScore: number | null
  source: 'externo' | 'interno'
  contractStatus: 'ok' | 'warning' | 'critical'
  monthsRemaining: number | null
  marketValueFormatted: string
  marketValueRaw: number
  minutesPlayed: number
  ageNum: number
  // All raw stats accessible by key
  [key: string]: string | number | null
}

// ─── FILTER STATE ─────────────────────────────────────────────────────────────

export interface FilterState {
  search: string
  positions: string[]
  leagues: string[]
  teamSearch: string
  minMinutes: number
  maxMinutes: number
  minMarketValue: number
  maxMarketValue: number
  minAge: number
  maxAge: number
  contractFrom: string
  contractTo: string
  maxContractMonths: number  // 0 = all, otherwise filter by max months remaining
  representante: string  // Filter by agent/representative
  pie: string  // 'izquierdo' | 'derecho' | 'ambos' | '' (all)
  minHeight: number  // cm
  maxHeight: number  // cm
  selectedMetrics: string[]  // Metrics to show as columns
}

// ─── SORT STATE ──────────────────────────────────────────────────────────────

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}

// ─── APP DATA CONTEXT ─────────────────────────────────────────────────────────

export interface AppData {
  external: EnrichedPlayer[]
  internal: EnrichedPlayer[]
  monitoring: MonitoringPlayer[]
  normalized: NormalizedPlayer[]
  evolution: EvolutionEntry[]
  subjectiveMetrics: SubjectiveMetric[]
  marketValueHistory: MarketValueHistoryEntry[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

// ─── RADAR / CHART TYPES ─────────────────────────────────────────────────────

export interface RadarDataPoint {
  subject: string
  fullMetric: string
  player: number
  average: number
  fullMark: number
}

export interface ComparisonPlayer {
  player: EnrichedPlayer
  color: string
  label: string
}

// ─── MONITORING SCORING HISTORY ──────────────────────────────────────────────

export interface ScoreHistoryEntry {
  date: string  // ISO date string
  ggScore: number
  opportunityScore?: number
}

export interface MonitoringPlayerStatus {
  playerId: string  // Unique identifier (Jugador name)
  status: ManagementStatus
  scoreHistory: ScoreHistoryEntry[]
  notes?: string
  lastUpdated: string  // ISO date string
}
