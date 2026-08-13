export interface AgencyCoach {
  key: string
  fullName: string
  photo: string | null
  status: 'activo' | 'sin_club'
  club: string | null
  apiTeamId: number | null
  reserveApiTeamId?: number | null
  leagueApiId?: number | null
  leagueName?: string | null
  leagueSeason?: number | null
  coachApiId?: number | null
}

export const AGENCY_COACHES: AgencyCoach[] = [
  {
    key: 'domingo',
    fullName: 'Nicolás Domingo',
    photo: '/coaches/domingo.png',
    status: 'activo',
    club: 'Temperley',
    apiTeamId: 454,
    leagueApiId: 129,
    leagueName: 'Primera Nacional',
    leagueSeason: 2026,
  },
  {
    key: 'stillitano',
    fullName: 'Leandro Stillitano',
    photo: '/coaches/stillitano.png',
    status: 'sin_club',
    club: null,
    apiTeamId: null,
  },
]

export function getCoachByKey(key: string): AgencyCoach | undefined {
  return AGENCY_COACHES.find(c => c.key === key)
}
