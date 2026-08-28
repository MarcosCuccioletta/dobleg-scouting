import { supabase } from '@/lib/supabase'
import type { AgencyCoach } from '@/constants/agencyCoaches'

interface AgencyCoachRow {
  key: string
  full_name: string
  photo_url: string | null
  status: 'activo' | 'sin_club'
  club: string | null
  api_team_id: number | null
  reserve_api_team_id: number | null
  league_api_id: number | null
  league_name: string | null
  league_season: number | null
  coach_api_id: number | null
  relationship: 'propio' | 'intermediado'
}

function mapRow(row: AgencyCoachRow): AgencyCoach {
  return {
    key: row.key,
    fullName: row.full_name,
    photo: row.photo_url,
    status: row.status,
    club: row.club,
    apiTeamId: row.api_team_id,
    reserveApiTeamId: row.reserve_api_team_id,
    leagueApiId: row.league_api_id,
    leagueName: row.league_name,
    leagueSeason: row.league_season,
    coachApiId: row.coach_api_id,
    relationship: row.relationship,
  }
}

export async function listAgencyCoaches(): Promise<AgencyCoach[]> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .select('*')
    .eq('active', true)
    .order('full_name')
  if (error || !data) return []
  return (data as AgencyCoachRow[]).map(mapRow)
}

export async function getAgencyCoachByKey(key: string): Promise<AgencyCoach | null> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as AgencyCoachRow)
}

export async function createAgencyCoach(input: {
  key: string
  fullName: string
  photo: string | null
  club: string | null
  relationship: 'propio' | 'intermediado'
}): Promise<AgencyCoach> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .insert({
      key: input.key,
      full_name: input.fullName,
      photo_url: input.photo,
      club: input.club,
      status: input.club ? 'activo' : 'sin_club',
      relationship: input.relationship,
    })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('No se pudo crear el entrenador')
  return mapRow(data as AgencyCoachRow)
}
