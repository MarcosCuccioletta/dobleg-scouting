export interface TeamMember {
  id: number
  name: string
  active: boolean
}

export type NeedStatus = 'abierto' | 'cerrado'
export type NegotiationStatus = 'contactado' | 'reunion' | 'oferta_enviada' | 'en_espera' | 'cerrado_exitoso' | 'cerrado_rechazado'

export interface ClubNeed {
  id: number
  team_id: number
  team_name: string
  team_logo: string | null
  position_label: string
  status: NeedStatus
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface Negotiation {
  id: number
  team_id: number
  team_name: string
  team_logo: string | null
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  contact_name: string | null
  contact_role: string | null
  status: NegotiationStatus
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface MarketNote {
  id: number
  negotiation_id: number | null
  need_id: number | null
  body: string
  is_meeting: boolean
  is_system: boolean
  author_id: string | null
  author_name: string | null
  created_at: string
}

export interface MarketTeamSearchResult {
  id: number
  name: string
  logo: string | null
}
