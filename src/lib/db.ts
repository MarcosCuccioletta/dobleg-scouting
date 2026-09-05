import { supabase } from './supabase'
import { CLUB_ID } from '@/constants/club'

// Tablas "de club": cada club ve y escribe sólo sus propias filas. Si agregás
// una tabla nueva con columna club_id, sumala acá — si te olvidás, sus queries
// quedan sin scopear (el mismo bug que mezcló Seguimiento GG entre plataformas).
// Ver docs/superpowers/specs/2026-09-05-multi-club-memberships-design.md.
const CLUB_SCOPED_TABLES = [
  'agency_classifications',
  'agency_classification_history',
  'agency_players',
  'agency_coaches',
  'agency_manual_fixtures',
  'coach_future_squads',
  'coach_match_notes',
  'coach_match_team_stats',
  'coach_tactical_boards',
  'coach_training_sessions',
  'coach_video_analysis_buckets',
  'coach_video_analysis_matches',
  'market_negotiations',
  'market_negotiation_notes',
  'market_club_needs',
  'market_need_candidates',
  'market_team_members',
  'gps_entries',
  'player_videos',
  'club_squads',
  'scout_players',
  'scout_players_status',
] as const

export type ClubScopedTable = typeof CLUB_SCOPED_TABLES[number]

function withClubId<T extends Record<string, unknown>>(row: T) {
  return { ...row, club_id: CLUB_ID }
}

/**
 * Reemplazo de `supabase.from(table)` para las tablas "de club": inyecta el
 * filtro/campo club_id en cada operación, para que ningún call site pueda
 * olvidarse de scopear por club.
 */
export function db(table: ClubScopedTable) {
  const qb = supabase.from(table)
  return {
    select: (...args: any[]) => (qb.select as any)(...args).eq('club_id', CLUB_ID),
    insert: (values: any, options?: any) =>
      (qb.insert as any)(Array.isArray(values) ? values.map(withClubId) : withClubId(values), options),
    upsert: (values: any, options?: any) =>
      (qb.upsert as any)(Array.isArray(values) ? values.map(withClubId) : withClubId(values), options),
    update: (values: any) => (qb.update as any)(values).eq('club_id', CLUB_ID),
    delete: () => qb.delete().eq('club_id', CLUB_ID),
  }
}
