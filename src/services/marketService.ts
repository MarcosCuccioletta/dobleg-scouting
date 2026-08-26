import { supabase } from '@/lib/supabase'
import type { TeamMember, ClubNeed, Negotiation, MarketNote, MarketTeamSearchResult, NeedStatus, NegotiationStatus } from '@/types/market'

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('market_team_members')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function searchMarketTeams(query: string): Promise<MarketTeamSearchResult[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, logo')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function fetchClubNeeds(): Promise<ClubNeed[]> {
  const { data, error } = await supabase
    .from('market_club_needs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchNegotiations(): Promise<Negotiation[]> {
  const { data, error } = await supabase
    .from('market_negotiations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CreateClubNeedInput {
  team_id: number
  team_name: string
  team_logo: string | null
  position_label: string
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
}

export async function createClubNeed(input: CreateClubNeedInput, createdById: string | null, createdByName: string): Promise<ClubNeed | null> {
  const { data, error } = await supabase
    .from('market_club_needs')
    .insert({ ...input, created_by_id: createdById, created_by_name: createdByName })
    .select()
    .single()
  if (error) { console.error('createClubNeed error:', error); return null }
  return data
}

export interface CreateNegotiationInput {
  team_id: number
  team_name: string
  team_logo: string | null
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  contact_name: string | null
  contact_role: string | null
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
}

export async function createNegotiation(input: CreateNegotiationInput, createdById: string | null, createdByName: string): Promise<Negotiation | null> {
  const { data, error } = await supabase
    .from('market_negotiations')
    .insert({ ...input, created_by_id: createdById, created_by_name: createdByName })
    .select()
    .single()
  if (error) { console.error('createNegotiation error:', error); return null }
  return data
}

export async function updateNeedStatus(id: number, status: NeedStatus): Promise<boolean> {
  const { error } = await supabase.from('market_club_needs').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateNeedStatus error:', error); return false }
  return true
}

export async function updateNegotiationStatus(id: number, status: NegotiationStatus): Promise<boolean> {
  const { error } = await supabase.from('market_negotiations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateNegotiationStatus error:', error); return false }
  return true
}

export interface PlayerIdentity {
  name: string
  birth_date: string | null
  photo: string | null
}

/**
 * Busca nombre/fecha de nacimiento/foto reales por id de la API — fuente de
 * verdad única para "arreglar" el nombre de una negociación cuando se la
 * vincula a un jugador real. Los jefes que cargan negociaciones suelen
 * escribir mal nombres/apellidos; el nombre correcto sólo se sabe con certeza
 * acá, no en lo que se tipeó al crear la negociación.
 */
export async function fetchPlayerIdentity(playerApiId: number): Promise<PlayerIdentity | null> {
  const { data, error } = await supabase
    .from('players')
    .select('name, birth_date, photo')
    .eq('id', playerApiId)
    .maybeSingle()
  if (error) { console.error('fetchPlayerIdentity error:', error); return null }
  return data
}

/**
 * Vincula el jugador y, si se resuelve su identidad real, corrige
 * `player_name` en el mismo paso — así el nombre prolijo del jugador de la
 * API reemplaza lo que se haya tipeado (con errores u otros) al crear la
 * negociación.
 */
export async function linkNegotiationPlayer(id: number, playerApiId: number, playerSource: 'interno' | 'externo' | null, correctedName?: string | null): Promise<boolean> {
  const update: Record<string, unknown> = { player_api_id: playerApiId, player_source: playerSource, updated_at: new Date().toISOString() }
  if (correctedName) update.player_name = correctedName
  const { error } = await supabase
    .from('market_negotiations')
    .update(update)
    .eq('id', id)
  if (error) { console.error('linkNegotiationPlayer error:', error); return false }
  return true
}

/**
 * Reasigna y deja una nota automática con el historial del cambio.
 *
 * La nota `is_system=true` es la prueba de auditoría del handoff — si falla,
 * la reasignación completa se considera fallida. Se actualiza el padre
 * primero para tener el `fromName` fresco en la nota; si la nota luego falla
 * al insertarse, se revierte la fila del padre a su responsable original
 * para no dejarla reasignada sin rastro, y se devuelve `false` reportando el
 * fallo de la operación completa (no queda ambiguo qué escritura falló: se
 * loguean ambas por separado).
 */
export async function reassignNeed(id: number, newAssigneeId: number, newAssigneeName: string, actingUserId: string | null, actingUserName: string): Promise<boolean> {
  const { data: current } = await supabase.from('market_club_needs').select('assigned_to_id, assigned_to_name').eq('id', id).single()
  const { error } = await supabase
    .from('market_club_needs')
    .update({ assigned_to_id: newAssigneeId, assigned_to_name: newAssigneeName, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('reassignNeed error:', error); return false }
  const fromName = current?.assigned_to_name ?? 'sin responsable'
  const { error: noteError } = await supabase.from('market_negotiation_notes').insert({
    need_id: id,
    body: `${actingUserName} reasignó de ${fromName} a ${newAssigneeName}.`,
    is_system: true,
    author_id: actingUserId,
    author_name: actingUserName,
  })
  if (noteError) {
    console.error('reassignNeed note error:', noteError)
    const { error: rollbackError } = await supabase
      .from('market_club_needs')
      .update({ assigned_to_id: current?.assigned_to_id ?? null, assigned_to_name: current?.assigned_to_name ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (rollbackError) console.error('reassignNeed rollback error:', rollbackError)
    return false
  }
  return true
}

export async function reassignNegotiation(id: number, newAssigneeId: number, newAssigneeName: string, actingUserId: string | null, actingUserName: string): Promise<boolean> {
  const { data: current } = await supabase.from('market_negotiations').select('assigned_to_id, assigned_to_name').eq('id', id).single()
  const { error } = await supabase
    .from('market_negotiations')
    .update({ assigned_to_id: newAssigneeId, assigned_to_name: newAssigneeName, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('reassignNegotiation error:', error); return false }
  const fromName = current?.assigned_to_name ?? 'sin responsable'
  const { error: noteError } = await supabase.from('market_negotiation_notes').insert({
    negotiation_id: id,
    body: `${actingUserName} reasignó de ${fromName} a ${newAssigneeName}.`,
    is_system: true,
    author_id: actingUserId,
    author_name: actingUserName,
  })
  if (noteError) {
    console.error('reassignNegotiation note error:', noteError)
    const { error: rollbackError } = await supabase
      .from('market_negotiations')
      .update({ assigned_to_id: current?.assigned_to_id ?? null, assigned_to_name: current?.assigned_to_name ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (rollbackError) console.error('reassignNegotiation rollback error:', rollbackError)
    return false
  }
  return true
}

export async function fetchNotesFor(target: { negotiationId?: number; needId?: number }): Promise<MarketNote[]> {
  let query = supabase.from('market_negotiation_notes').select('*')
  query = target.negotiationId != null ? query.eq('negotiation_id', target.negotiationId) : query.eq('need_id', target.needId!)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Agrega una nota y, si trae fecha de seguimiento, la refleja en el padre
 * (negociación u objetivo) en el mismo paso. La nota ya quedó guardada en
 * ese punto — un fallo al sincronizar `next_followup_date` en el padre no
 * invalida la nota en sí, así que se loguea el error pero igual se devuelve
 * la nota creada (no `null`) para no ocultar una escritura que sí tuvo
 * éxito. El caller puede inspeccionar los logs si necesita saber que el
 * seguimiento no quedó reflejado en el padre.
 */
export async function addNoteTo(
  target: { negotiationId?: number; needId?: number },
  body: string,
  isMeeting: boolean,
  nextFollowupDate: string | null,
  authorId: string | null,
  authorName: string,
): Promise<MarketNote | null> {
  const { data, error } = await supabase
    .from('market_negotiation_notes')
    .insert({
      negotiation_id: target.negotiationId ?? null,
      need_id: target.needId ?? null,
      body,
      is_meeting: isMeeting,
      author_id: authorId,
      author_name: authorName,
    })
    .select()
    .single()
  if (error) { console.error('addNoteTo error:', error); return null }

  if (nextFollowupDate) {
    const table = target.negotiationId != null ? 'market_negotiations' : 'market_club_needs'
    const id = target.negotiationId ?? target.needId!
    const { error: syncError } = await supabase
      .from(table)
      .update({ next_followup_date: nextFollowupDate, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (syncError) console.error('addNoteTo followup sync error:', syncError)
  }

  return data
}
