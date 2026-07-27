// "Últimos 5 partidos": la lista sale de la API, pero manda el usuario.
//
// La API se queda corta seguido —el último partido puede tardar en cargarse— así
// que el paso 3 arranca con las filas de la API ya cargadas y el usuario puede
// editarlas, borrarlas o agregar el partido que falta. Mientras no toque nada,
// `content.ultimos5` queda vacío y el informe sigue lo que trae la API.

import type { MatchRow } from './types'
import type { Last5Row } from './useInformeEnrichment'

export function isEmptyMatchRow(r: MatchRow): boolean {
  return !r.rival.trim() && !r.resultado.trim() && !r.rating.trim() && !r.minutos.trim()
}

export const EMPTY_MATCH_ROW: MatchRow = { rival: '', resultado: '', rating: '', minutos: '', fecha: '' }

/** Filas de la API en el formato editable del paso 3. */
export function apiRowsToMatchRows(rows: Last5Row[]): MatchRow[] {
  return rows.map(r => ({
    rival: r.rival === '—' ? '' : r.rival,
    resultado: r.result === '—' ? '' : r.result,
    rating: r.rating === '—' ? '' : r.rating,
    minutos: String(r.minutes),
    fecha: r.date,
  }))
}

/**
 * Desenlace de un resultado escrito a mano ("2-1"): se lee como goles propios
 * primero, que es como lo escribe cualquiera. Si no se entiende, sin color.
 */
export function parseOutcome(resultado: string): Last5Row['outcome'] {
  const m = resultado.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/)
  if (!m) return null
  const own = Number(m[1])
  const opp = Number(m[2])
  return own > opp ? 'win' : own < opp ? 'loss' : 'draw'
}

/** Lo que se publica: lo editado a mano si hay algo, si no lo de la API. */
export function resolveLast5(ultimos5: MatchRow[] | undefined, apiRows: Last5Row[]): Last5Row[] {
  const manual = (ultimos5 ?? []).filter(r => !isEmptyMatchRow(r))
  if (manual.length === 0) return apiRows

  return manual.map(r => {
    const minutes = Number(String(r.minutos).replace(/[^\d.-]/g, ''))
    return {
      rival: r.rival.trim() || '—',
      result: r.resultado.trim() || '—',
      outcome: parseOutcome(r.resultado),
      rating: r.rating.trim() || '—',
      minutes: Number.isFinite(minutes) ? minutes : 0,
      date: r.fecha ?? '',
    }
  })
}

/** Filas del editor: lo guardado si hay algo, si no las de la API como punto de partida. */
export function editableLast5(ultimos5: MatchRow[] | undefined, apiRows: Last5Row[]): MatchRow[] {
  const saved = ultimos5 ?? []
  if (saved.length > 0) return saved
  return apiRowsToMatchRows(apiRows)
}
