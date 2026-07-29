import { stripAccents } from './normalize'
import type { AgencyPlayer } from '@/constants/agencyPlayers'

/** Partículas que forman parte del apellido ("Lo Celso", "De la Cruz"). */
const PARTICLES = new Set([
  'lo', 'de', 'del', 'la', 'las', 'los', 'di', 'da', 'san', 'santa', 'mac', 'mc', 'van', 'von',
])

function norm(s: string): string {
  return stripAccents(s).toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parte un nombre completo en nombres de pila y apellido. El apellido se toma desde
 * el final e incorpora las partículas que lo preceden.
 */
export function splitName(full: string): { given: string[]; surname: string } {
  const parts = norm(full).split(' ').filter(Boolean)
  if (parts.length <= 1) return { given: [], surname: parts[0] ?? '' }
  // Puede llegar a 0: "Lo Celso" es apellido entero, sin nombre de pila.
  let i = parts.length - 1
  while (i > 0 && PARTICLES.has(parts[i - 1])) i--
  return { given: parts.slice(0, i), surname: parts.slice(i).join(' ') }
}

/** Interpreta la celda del PDF, que puede venir como "Apellido I" o "I Apellido". */
function parseCellName(raw: string): { surname: string; initial: string | null } {
  const parts = norm(raw).split(' ').filter(Boolean)
  if (parts.length === 0) return { surname: '', initial: null }
  if (parts.length === 1) return { surname: parts[0], initial: null }

  // "Gonzalez G" → apellido + inicial
  if (parts[parts.length - 1].length === 1) {
    return { surname: parts.slice(0, -1).join(' '), initial: parts[parts.length - 1] }
  }
  // "G Gonzalez" / "A. Steimbach" → inicial + apellido
  if (parts[0].length === 1) {
    return { surname: parts.slice(1).join(' '), initial: parts[0] }
  }
  // Nombre completo
  const { given, surname } = splitName(raw)
  return { surname, initial: given[0]?.[0] ?? null }
}

/**
 * Devuelve los `fullName` del roster compatibles con la celda. Vacío = el jugador no
 * es de la agencia; más de uno = ambiguo y lo resuelve el usuario en la revisión.
 */
export function matchRosterName(raw: string, roster: AgencyPlayer[]): string[] {
  const cell = norm(raw)
  if (!cell) return []

  // 1) Coincidencia exacta con el nombre completo o el nombre corto.
  const exact = roster.filter(p => norm(p.fullName) === cell || norm(p.shortName) === cell)
  if (exact.length > 0) return exact.map(p => p.fullName)

  // 2) Apellido (+ inicial si la celda la trae).
  const { surname, initial } = parseCellName(raw)
  if (!surname) return []

  const bySurname = roster.filter(p => splitName(p.fullName).surname === surname)
  if (bySurname.length === 0) return []
  if (!initial) return bySurname.map(p => p.fullName)

  const byInitial = bySurname.filter(p => {
    const { given } = splitName(p.fullName)
    return given.some(g => g[0] === initial)
  })
  return (byInitial.length > 0 ? byInitial : bySurname).map(p => p.fullName)
}
