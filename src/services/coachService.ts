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
}

export interface CoachMatchNote {
  id: number
  coach_key: string
  fixture_id: number
  note: string
  author: string | null
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
  return data || []
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

export async function getMatchNote(coachKey: string, fixtureId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select('note')
    .eq('coach_key', coachKey)
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (error || !data) return null
  return data.note
}

export async function upsertMatchNote(coachKey: string, fixtureId: number, note: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('coach_match_notes').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    note,
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
