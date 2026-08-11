// src/services/futureSquadService.ts
import { supabase } from '@/lib/supabase'

export type SlotPlayerSource = 'squad' | 'candidate'

export interface FutureSquadSlot {
  slotKey: string                    // clave de FORMATIONS[formationType].positions, ej. 'LB'
  source: SlotPlayerSource | null    // null = slot vacio
  playerId: number | string | null   // number = id de API-Football (squad), string = id de scoring (candidate)
  playerName: string | null
  playerNumber: number | null        // solo aplica a source === 'squad'
  ggScore: number | null             // solo aplica a source === 'candidate'
}

export interface FutureSquadBaja {
  id: string          // uuid generado en el cliente
  playerId: number     // id de API-Football
  playerName: string
  reason: string        // texto libre, puede quedar vacio
}

export interface FutureSquadPlan {
  coach_key: string
  formation_type: string
  slots: FutureSquadSlot[]
  bajas: FutureSquadBaja[]
  updated_at: string
}

export async function getFutureSquad(coachKey: string): Promise<FutureSquadPlan | null> {
  const { data, error } = await supabase
    .from('coach_future_squads')
    .select('*')
    .eq('coach_key', coachKey)
    .maybeSingle()

  if (error) {
    console.error('Error cargando plantel a futuro:', error)
    return null
  }
  return (data as unknown as FutureSquadPlan) ?? null
}

export async function saveFutureSquad(
  coachKey: string,
  formationType: string,
  slots: FutureSquadSlot[],
  bajas: FutureSquadBaja[],
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_future_squads')
    .upsert(
      { coach_key: coachKey, formation_type: formationType, slots, bajas, updated_at: new Date().toISOString() },
      { onConflict: 'coach_key' },
    )

  if (error) {
    console.error('Error guardando plantel a futuro:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
