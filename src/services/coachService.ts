import { supabase } from '@/lib/supabase'

export type TrainingSessionType = 'tactico' | 'fisico' | 'recuperacion' | 'set_pieces' | 'pre_rival' | 'otro'

export interface CoachTrainingSession {
  id: number
  coach_key: string
  session_date: string
  session_time: string | null
  type: TrainingSessionType
  title: string
  notes: string | null
  duration_minutes: number | null
  intensity: number | null
  focus_tags: string[]
  created_at: string
  updated_at: string
}

export interface CoachTrainingSessionInput {
  id?: number
  coach_key: string
  session_date: string
  session_time?: string | null
  type: TrainingSessionType
  title: string
  notes?: string | null
  duration_minutes?: number | null
  intensity?: number | null
  focus_tags?: string[]
}

export interface MatchNotePhases {
  defensiva: string | null
  ofensiva: string | null
  transiciones: string | null
  abp: string | null
  observaciones: string | null
}

export interface CoachMatchNote extends MatchNotePhases {
  id: number
  coach_key: string
  fixture_id: number
  author: string | null
  created_at: string
  updated_at: string
}

export interface CoachMatchTeamStats {
  id: number
  coach_key: string
  fixture_id: number
  possession_pct: number | null
  xg_for: number | null
  xg_against: number | null
  raw_metrics: Record<string, unknown>
  source_file: string | null
  created_at: string
  updated_at: string
}

export async function listTrainingSessions(coachKey: string): Promise<CoachTrainingSession[]> {
  const { data, error } = await supabase
    .from('coach_training_sessions')
    .select('*')
    .eq('coach_key', coachKey)
    .order('session_date', { ascending: true })

  if (error) {
    console.error('Error listando entrenamientos:', error)
    return []
  }
  return (data || []).map(r => ({ ...r, focus_tags: r.focus_tags ?? [] }))
}

export async function upsertTrainingSession(input: CoachTrainingSessionInput): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_training_sessions').upsert({
    ...(input.id ? { id: input.id } : {}),
    coach_key: input.coach_key,
    session_date: input.session_date,
    session_time: input.session_time ?? null,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    duration_minutes: input.duration_minutes ?? null,
    intensity: input.intensity ?? null,
    focus_tags: input.focus_tags ?? [],
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error guardando entrenamiento:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteTrainingSession(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_training_sessions').delete().eq('id', id)

  if (error) {
    console.error('Error borrando entrenamiento:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

const NOTE_PHASE_COLUMNS = 'defensiva, ofensiva, transiciones, abp, observaciones'

export async function listMatchNotePhases(coachKey: string): Promise<Record<number, MatchNotePhases>> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select(`fixture_id, ${NOTE_PHASE_COLUMNS}`)
    .eq('coach_key', coachKey)

  if (error || !data) {
    console.error('Error listando notas de partido:', error)
    return {}
  }

  const result: Record<number, MatchNotePhases> = {}
  for (const row of data as unknown as Array<MatchNotePhases & { fixture_id: number }>) {
    result[row.fixture_id] = {
      defensiva: row.defensiva,
      ofensiva: row.ofensiva,
      transiciones: row.transiciones,
      abp: row.abp,
      observaciones: row.observaciones,
    }
  }
  return result
}

export async function getMatchNotePhases(coachKey: string, fixtureId: number): Promise<MatchNotePhases | null> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select(NOTE_PHASE_COLUMNS)
    .eq('coach_key', coachKey)
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as MatchNotePhases
}

export async function upsertMatchNotePhases(
  coachKey: string,
  fixtureId: number,
  phases: MatchNotePhases,
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('coach_match_notes').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    defensiva: phases.defensiva || null,
    ofensiva: phases.ofensiva || null,
    transiciones: phases.transiciones || null,
    abp: phases.abp || null,
    observaciones: phases.observaciones || null,
    author: user?.user_metadata?.full_name || user?.email || null,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'coach_key,fixture_id',
  })

  if (error) {
    console.error('Error guardando nota de partido:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function listCoachMatchTeamStats(coachKey: string): Promise<CoachMatchTeamStats[]> {
  const { data, error } = await supabase
    .from('coach_match_team_stats')
    .select('*')
    .eq('coach_key', coachKey)

  if (error || !data) {
    console.error('Error listando estadisticas de partido:', error)
    return []
  }
  return data
}

export async function upsertCoachMatchTeamStats(
  coachKey: string,
  fixtureId: number,
  stats: {
    possessionPct: number | null
    xgFor: number | null
    xgAgainst: number | null
    rawMetrics: Record<string, unknown>
    sourceFile: string | null
  },
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_match_team_stats').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    possession_pct: stats.possessionPct,
    xg_for: stats.xgFor,
    xg_against: stats.xgAgainst,
    raw_metrics: stats.rawMetrics,
    source_file: stats.sourceFile,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'coach_key,fixture_id',
  })

  if (error) {
    console.error('Error guardando estadisticas de partido:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function fetchSquadMinutes(
  playerIds: number[],
  sinceDays = 30,
): Promise<Record<number, { minutes: number; matches: number }>> {
  if (playerIds.length === 0) return {}

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('player_match_stats')
    .select('player_id, minutes, fixtures!inner(date)')
    .in('player_id', playerIds)
    .gte('fixtures.date', since)

  if (error || !data) {
    console.error('Error buscando minutos de plantel:', error)
    return {}
  }

  const result: Record<number, { minutes: number; matches: number }> = {}
  for (const row of data as unknown as Array<{ player_id: number; minutes: number }>) {
    if (!result[row.player_id]) result[row.player_id] = { minutes: 0, matches: 0 }
    result[row.player_id].minutes += row.minutes
    result[row.player_id].matches += 1
  }
  return result
}

/**
 * Chequea cuáles de estos ids de jugador (id de API-Football, igual a `players.id`
 * en Supabase) ya tienen ficha real en la plataforma. Se usa para que el plantel de
 * un entrenador linkee a la ficha rica (Score GG, historial, transfers) en vez de
 * crear un stub vacío para jugadores que ya están en la base.
 */
export async function fetchExistingPlayerIds(playerIds: number[]): Promise<Set<number>> {
  if (playerIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('players')
    .select('id')
    .in('id', playerIds)

  if (error || !data) {
    console.error('Error buscando jugadores existentes en Supabase:', error)
    return new Set()
  }
  return new Set(data.map(row => row.id))
}
