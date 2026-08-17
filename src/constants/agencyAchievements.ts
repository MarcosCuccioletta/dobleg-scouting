import { normalizeName } from '@/utils/scoring'
import type { AgencyPlayer } from './agencyPlayers'

export type AchievementType = 'liga' | 'copa' | 'copa_liga' | 'continental' | 'otro'

export interface AgencyAchievement {
  playerName: string // fullName, matcheado contra AgencyPlayer.fullName
  type: AchievementType
  competition: string // ej. "Liga Profesional Argentina"
  club: string // club con el que lo ganó
  year: number // temporada, para el gráfico evolutivo
  dateLabel?: string // ej. "Apertura 2025", opcional
}

export const ACHIEVEMENT_TYPE_LABEL: Record<AchievementType, string> = {
  liga: 'Liga',
  copa: 'Copa',
  copa_liga: 'Copa de Liga',
  continental: 'Continental',
  otro: 'Otro',
}

export const ACHIEVEMENT_TYPE_ORDER: AchievementType[] = ['liga', 'copa', 'copa_liga', 'continental', 'otro']

// Cargado a mano por Claude cuando el usuario reporta un título por chat (jugador,
// torneo, tipo, año, club). Sin pantalla de carga en la app — ver spec
// docs/superpowers/specs/2026-08-17-panel-interno-clubes-logros-design.md.
export const AGENCY_ACHIEVEMENTS: AgencyAchievement[] = []

export interface YearlyAchievementCount {
  year: number
  total: number
  byType: Record<AchievementType, number>
}

function emptyTypeCounts(): Record<AchievementType, number> {
  return { liga: 0, copa: 0, copa_liga: 0, continental: 0, otro: 0 }
}

export function aggregateAchievementsByYear(achievements: AgencyAchievement[]): YearlyAchievementCount[] {
  if (achievements.length === 0) return []

  const years = achievements.map(a => a.year)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  const result: YearlyAchievementCount[] = []
  for (let year = minYear; year <= maxYear; year++) {
    const inYear = achievements.filter(a => a.year === year)
    const byType = emptyTypeCounts()
    for (const a of inYear) byType[a.type]++
    result.push({ year, total: inYear.length, byType })
  }
  return result
}

export function resolveAchievementPlayer(
  achievement: AgencyAchievement,
  players: AgencyPlayer[],
): AgencyPlayer | null {
  const target = normalizeName(achievement.playerName)
  return players.find(p => normalizeName(p.fullName) === target) ?? null
}
