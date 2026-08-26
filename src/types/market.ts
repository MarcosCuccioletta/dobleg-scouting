export interface TeamMember {
  id: number
  name: string
  active: boolean
  /** Cuenta real de la app vinculada a esta persona, si la tiene — permite que
   * la campanita de alertas sepa "esto es mío" sin depender de que el nombre
   * coincida exactamente con el de la cuenta logueada. */
  user_id: string | null
}

export type NeedStatus = 'abierto' | 'cerrado'
export type NegotiationStatus = 'contactado' | 'reunion' | 'oferta_enviada' | 'en_espera' | 'cerrado_exitoso' | 'cerrado_rechazado'
export type CandidateStatus = 'propuesto' | 'en_negociacion' | 'descartado' | 'fichado'

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

/**
 * Una negociacion real tiene hasta 3 personas distintas de un lado y otro:
 * el representante del jugador (agente, no es de la agencia), el director
 * deportivo del club ACTUAL del jugador (para sacarlo) y el del club al que
 * se lo quiere llevar (para meterlo, `team_id`/`team_name`/`team_logo`).
 *
 * Ambos clubes son opcionales, no solo el actual: `team_id` null representa
 * "el objetivo es dejarlo libre" (sin destino puntual todavia), y
 * `current_team_id` null representa "el jugador ya está libre" (sin club
 * actual). Al menos uno de los dos suele tener valor, pero no se fuerza.
 */
export interface Negotiation {
  id: number
  team_id: number | null
  team_name: string | null
  team_logo: string | null
  current_team_id: number | null
  current_team_name: string | null
  current_team_logo: string | null
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  agent_name: string | null
  target_club_contact_name: string | null
  target_club_contact_role: string | null
  current_club_contact_name: string | null
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

/**
 * Un objetivo de club no es "un" jugador — el club va evaluando varios
 * candidatos para el mismo puesto a medida que se los ofrecen. Cada fila acá
 * es un jugador propuesto para ese objetivo puntual.
 */
export interface NeedCandidate {
  id: number
  need_id: number
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  status: CandidateStatus
  added_by_id: string | null
  added_by_name: string | null
  created_at: string
}

export interface MarketTeamSearchResult {
  id: number
  name: string
  logo: string | null
}
