// Tarjetas del bloque Continuidad (pestaña General). La API sólo cuenta los
// partidos que tiene cargados —y filtrados por posición—, así que el usuario
// puede pisar cualquier valor a mano: lo que escribe manda.
//
// Reglas: vacío = valor automático de la API · "-" = esa tarjeta no se muestra.

import { t, type Lang } from './i18n'
import type { ContinuityOverrides, InformeContent } from './types'
import type { Continuity } from './useInformeEnrichment'

export interface ContinuityTile {
  key: keyof ContinuityOverrides
  label: string
  value: string
}

const HIDE_TOKENS = new Set(['-', '–', '—', 'x', 'X'])

const DEFS: { key: keyof ContinuityOverrides; tKey: string }[] = [
  { key: 'matches', tKey: 's_matches' },
  { key: 'starts', tKey: 's_starts' },
  { key: 'minutes', tKey: 's_minutes' },
  { key: 'last5', tKey: 's_last5' },
  { key: 'last10', tKey: 's_last10' },
]

/** Valores que trae la API, ya formateados (string vacío si no hay datos). */
export function autoContinuityValues(c: Continuity | null): Record<keyof ContinuityOverrides, string> {
  if (!c) return { matches: '', starts: '', minutes: '', last5: '', last10: '' }
  return {
    matches: String(c.matches),
    starts: String(c.starts),
    minutes: c.minutes.toLocaleString('es-AR'),
    last5: `${c.last5Played}/${c.last5Total}`,
    last10: `${c.last10Played}/${c.last10Total}`,
  }
}

/**
 * Tarjetas finales a mostrar. Devuelve [] si el bloque está oculto o si no queda
 * ningún valor (ni de la API ni escrito a mano).
 */
export function continuityTiles(
  content: Pick<InformeContent, 'hideContinuity' | 'continuidad'>,
  c: Continuity | null,
  lang: Lang,
): ContinuityTile[] {
  if (content.hideContinuity) return []
  const auto = autoContinuityValues(c)
  const overrides = content.continuidad ?? {}

  return DEFS.map(({ key, tKey }) => {
    const manual = (overrides[key] ?? '').trim()
    return { key, label: t(lang, tKey), value: manual || auto[key] }
  }).filter(tile => tile.value !== '' && !HIDE_TOKENS.has(tile.value))
}
