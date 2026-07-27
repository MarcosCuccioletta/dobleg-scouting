// Tarjetas del bloque Continuidad (pestaña General). La API sólo cuenta los
// partidos que tiene cargados —y filtrados por posición—, así que el usuario
// manda: puede reescribir el número, el título, o sacar la tarjeta entera
// (típico: "Titularidades", que no siempre se sabe).
//
// Reglas: valor vacío = valor automático de la API · destildada = no se muestra.

import { t, type Lang } from './i18n'
import type { ContinuityKey, ContinuityOverrides, InformeContent } from './types'
import type { Continuity } from './useInformeEnrichment'

export interface ContinuityTile {
  key: ContinuityKey
  label: string
  value: string
}

// Compatibilidad: antes se sacaba una tarjeta escribiendo "-" en el valor.
const HIDE_TOKENS = new Set(['-', '–', '—', 'x', 'X'])

export const CONTINUITY_DEFS: { key: ContinuityKey; tKey: string }[] = [
  { key: 'matches', tKey: 's_matches' },
  { key: 'starts', tKey: 's_starts' },
  { key: 'minutes', tKey: 's_minutes' },
  { key: 'last5', tKey: 's_last5' },
  { key: 'last10', tKey: 's_last10' },
]

/** Valores que trae la API, ya formateados (string vacío si no hay datos). */
export function autoContinuityValues(c: Continuity | null): Record<ContinuityKey, string> {
  if (!c) return { matches: '', starts: '', minutes: '', last5: '', last10: '' }
  return {
    matches: String(c.matches),
    starts: String(c.starts),
    minutes: c.minutes.toLocaleString('es-AR'),
    last5: `${c.last5Played}/${c.last5Total}`,
    last10: `${c.last10Played}/${c.last10Total}`,
  }
}

/** Título por defecto de cada tarjeta, en el idioma del informe. */
export function defaultContinuityLabel(key: ContinuityKey, lang: Lang): string {
  const def = CONTINUITY_DEFS.find(d => d.key === key)
  return def ? t(lang, def.tKey) : key
}

export function isContinuityTileHidden(overrides: ContinuityOverrides, key: ContinuityKey): boolean {
  if (overrides.hidden?.includes(key)) return true
  return HIDE_TOKENS.has((overrides[key] ?? '').trim())
}

/**
 * Tarjetas finales a mostrar. Devuelve [] si el bloque está oculto o si no queda
 * ninguna tarjeta con valor.
 */
export function continuityTiles(
  content: Pick<InformeContent, 'hideContinuity' | 'continuidad'>,
  c: Continuity | null,
  lang: Lang,
): ContinuityTile[] {
  if (content.hideContinuity) return []
  const auto = autoContinuityValues(c)
  const overrides = content.continuidad ?? {}

  return CONTINUITY_DEFS.filter(({ key }) => !isContinuityTileHidden(overrides, key))
    .map(({ key }) => ({
      key,
      label: (overrides.labels?.[key] ?? '').trim() || defaultContinuityLabel(key, lang),
      value: (overrides[key] ?? '').trim() || auto[key],
    }))
    .filter(tile => tile.value !== '')
}
