import { normalizeName } from '@/utils/scoring'
import { identityKey } from '@/context/DataContext'

export type AchievementType = 'liga' | 'copa' | 'copa_liga' | 'continental' | 'otro'

export interface AgencyAchievement {
  playerName: string // fullName; resuelto contra `Jugador` de una fila interna vía resolveAchievementNavigationTarget
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

/**
 * Resuelve a qué `Jugador` (fila interna) navegar al tocar un logro.
 *
 * Dos pasadas, exacta primero: `AgencyAchievement.playerName` siempre es el
 * nombre completo, pero el `Jugador` de una fila interna preexistente puede
 * seguir en formato corto del sheet ("M. Sanabria"). normalizeName no
 * reconcilia eso — hace falta identityKey (inicial:apellido), igual que
 * mergeAgencyIntoInternal. Probar primero el match exacto por normalizeName y
 * sólo caer a identityKey si no hay exacto evita que un `find()` con OR
 * devuelva la primera coincidencia fuzzy cuando el roster tiene una colisión
 * de identityKey real (p. ej. "Federico Paradela" y "Francesco Paradela",
 * ambos con shortName "F. Paradela" → misma clave "f:paradela").
 */
export function resolveAchievementNavigationTarget(
  achievement: AgencyAchievement,
  players: { Jugador: string }[],
): string | null {
  const exact = normalizeName(achievement.playerName)
  const exactMatch = players.find(p => normalizeName(p.Jugador) === exact)
  if (exactMatch) return exactMatch.Jugador

  const key = identityKey(achievement.playerName)
  return players.find(p => identityKey(p.Jugador) === key)?.Jugador ?? null
}
