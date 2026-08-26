import { supabase } from '@/lib/supabase'
import { identityKey } from '@/context/DataContext'

export type AgencyClass = 'A' | 'B' | 'C'

export interface ClassificationHistoryRow {
  id: number
  player_key: string
  player_name: string
  previous_class: AgencyClass | null
  new_class: AgencyClass
  changed_at: string
  changed_by_name: string | null
}

/** Misma clave que usa `mergeAgencyIntoInternal` para matchear un jugador de
 * `agencyPlayers.ts` contra el resto de la plataforma — una sola fuente de
 * identidad para que la clasificación se enganche en Interno/ficha/Panel sin
 * depender de un id numérico que no todos los jugadores de agencia tienen. */
export function agencyPlayerKey(name: string): string {
  return identityKey(name)
}

export async function fetchClassifications(): Promise<Map<string, AgencyClass>> {
  const { data, error } = await supabase
    .from('agency_classifications')
    .select('player_key, class')
  if (error) throw error
  return new Map((data ?? []).map(r => [r.player_key, r.class as AgencyClass]))
}

export async function setClassification(
  playerKey: string,
  playerName: string,
  newClass: AgencyClass,
  changedByName: string | null,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('agency_classifications')
    .select('class')
    .eq('player_key', playerKey)
    .maybeSingle()

  const previousClass = (existing?.class as AgencyClass | undefined) ?? null
  if (previousClass === newClass) return true

  const { error: upsertError } = await supabase
    .from('agency_classifications')
    .upsert({ player_key: playerKey, player_name: playerName, class: newClass, updated_at: new Date().toISOString(), updated_by_name: changedByName })
  if (upsertError) { console.error(upsertError); return false }

  const { error: historyError } = await supabase
    .from('agency_classification_history')
    .insert({ player_key: playerKey, player_name: playerName, previous_class: previousClass, new_class: newClass, changed_by_name: changedByName })
  if (historyError) console.error(historyError)

  return true
}

export async function deleteClassification(playerKey: string): Promise<boolean> {
  const { error } = await supabase
    .from('agency_classifications')
    .delete()
    .eq('player_key', playerKey)
  if (error) { console.error(error); return false }
  return true
}

export async function fetchClassificationHistorySince(sinceIso: string): Promise<ClassificationHistoryRow[]> {
  const { data, error } = await supabase
    .from('agency_classification_history')
    .select('*')
    .gte('changed_at', sinceIso)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
