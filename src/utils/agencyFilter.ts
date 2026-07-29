import { agencyKey } from '@/services/agencyPlayersService'
import { nameKey } from '@/utils/nameUtils'
import type { AgencyPlayer } from '@/constants/agencyPlayers'

/**
 * Detecta si un jugador ya es de Doble G. Se usa para sacarlos de las pantallas de
 * búsqueda de talento: un jugador que ya representamos no es una oportunidad.
 *
 * Matchea por nombre completo normalizado (fullName o shortName) y también por
 * inicial + apellido, porque la API y la lista de la agencia escriben distinto al
 * mismo jugador ("Juan Ignacio Díaz" vs "Juan Díaz").
 */
export function makeAgencyMatcher(roster: AgencyPlayer[]): (name: string) => boolean {
  const fullKeys = new Set<string>()
  const shortKeys = new Set<string>()
  for (const p of roster) {
    if (p.fullName) { fullKeys.add(agencyKey(p.fullName)); shortKeys.add(nameKey(p.fullName)) }
    if (p.shortName) { fullKeys.add(agencyKey(p.shortName)); shortKeys.add(nameKey(p.shortName)) }
  }
  return (name: string): boolean => {
    const value = (name ?? '').trim()
    if (!value) return false
    return fullKeys.has(agencyKey(value)) || shortKeys.has(nameKey(value))
  }
}

/** Saca de la lista a los jugadores que ya representa la agencia. */
export function excludeAgencyPlayers<T extends { name?: string | null }>(
  players: T[],
  roster: AgencyPlayer[],
): T[] {
  if (roster.length === 0) return players
  const isAgency = makeAgencyMatcher(roster)
  return players.filter(p => !isAgency(p.name ?? ''))
}
