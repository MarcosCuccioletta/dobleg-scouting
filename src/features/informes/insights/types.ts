// Tipos del motor de conclusiones ("Impacto"). Sin lógica y sin dependencias:
// los importan tanto los módulos puros como la UI y el export.

export type InsightBlockId = 'continuidad' | 'ofensivo' | 'plantel' | 'rendimiento' | 'resultados'

export const BLOCK_IDS: InsightBlockId[] = ['continuidad', 'ofensivo', 'plantel', 'rendimiento', 'resultados']

export type PeriodMode = 'signing' | 'season' | 'last10' | 'custom'

/** Lo que se guarda en el informe. */
export interface PeriodConfig {
  mode: PeriodMode
  from?: string   // 'YYYY-MM-DD', sólo cuando mode === 'custom'
  to?: string
}

/** Lo que sale de resolver la config contra los datos reales. */
export interface ResolvedPeriod {
  mode: PeriodMode
  from: string               // 'YYYY-MM-DD'
  to: string | null          // null = hasta hoy
  anchorDate: string | null  // fecha de llegada al club; sólo en mode 'signing'
}

export interface TeamFixture {
  id: number
  date: string            // ISO completo
  league_id: number
  home_team_id: number
  away_team_id: number
  score_home: number | null
  score_away: number | null
}

/** Fila de un jugador del plantel en un partido. */
export interface SquadMatchRow {
  player_id: number
  player_name: string
  fixture_id: number
  date: string
  minutes: number
  goals: number
  assists: number
  passes_key: number
  duels_won: number
  duels_total: number
  dribbles_success: number
  dribbles_attempted: number
  match_score: number | null
  detected_position: string | null
}

/** Fila del protagonista: agrega lo que hace falta para continuidad y resultados. */
export interface PlayerMatchRow extends SquadMatchRow {
  is_substitute: boolean
  team_id: number
  home_team_id: number
  away_team_id: number
  score_home: number | null
  score_away: number | null
}

export interface InjuryWindow {
  type: string
  start: string           // 'YYYY-MM-DD'
  end: string | null      // null = sigue lesionado
}

/** Una conclusión calculada. El texto se genera aparte, en text.ts. */
export interface InsightItem {
  id: string                                  // estable: 'ofe.share', 'plantel.assists', …
  values: Record<string, number | string>
  tone: 'strong' | 'neutral' | 'weak'
}

export interface InsightTile {
  id: string                                  // 'tile.pj', 'tile.ga', 'tile.share', 'tile.score'
  render: 'dots' | 'donut' | 'plain'
  values: Record<string, number | string>
  pct?: number                                // donut
  dots?: { filled: number; total: number }    // dots
}

export interface InsightGroup {
  id: InsightBlockId
  items: InsightItem[]
}

export type InsightWarning = 'goalsMismatch' | 'shortSample' | 'noTeamFixtures' | 'partialCoverage'

export interface InsightsResult {
  period: ResolvedPeriod
  tiles: InsightTile[]
  groups: InsightGroup[]
  warnings: InsightWarning[]
  minMinutes: number
  qualifiedCount: number   // jugadores del plantel que pasan el umbral
}

/** Config persistida en el informe. */
/** Texto escrito a mano para una tarjeta: número grande y/o texto de abajo. */
export interface TileOverride {
  value?: string
  sub?: string
}

export interface InsightsConfig {
  enabled: boolean
  period: PeriodConfig
  blocks: InsightBlockId[]
  hiddenItems: string[]
  overrides: Record<string, string>
  tileOverrides?: Record<string, TileOverride>
  minMinutes?: number
  teamMatchesOverride?: number
  teamGoalsOverride?: number
}
