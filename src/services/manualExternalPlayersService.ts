import { supabase } from '@/lib/supabase'

export interface ManualExternalPlayerRow {
  api_player_id: number
  full_name: string
  team: string
  position: string
  age: number | null
  photo: string | null
}

export async function listManualExternalPlayers(): Promise<ManualExternalPlayerRow[]> {
  const { data, error } = await supabase
    .from('manual_external_players')
    .select('api_player_id, full_name, team, position, age, photo')

  if (error || !data) {
    console.error('Error listando fichas manuales de Externo:', error)
    return []
  }
  return data
}

export async function createManualExternalPlayer(row: ManualExternalPlayerRow): Promise<ManualExternalPlayerRow> {
  const { data, error } = await supabase
    .from('manual_external_players')
    .upsert(row, { onConflict: 'api_player_id' })
    .select('api_player_id, full_name, team, position, age, photo')
    .single()

  if (error || !data) {
    console.error('Error creando ficha manual de Externo:', error)
    throw new Error(error?.message ?? 'No se pudo crear la ficha')
  }
  return data
}
