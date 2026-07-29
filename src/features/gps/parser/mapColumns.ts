import { normalizeLabel } from './normalize'
import type { GpsMetric, GpsMetricAlias, ColumnMapping } from '../types'

/** Pseudo-métrica: los minutos van a su propia columna en la tabla, no al jsonb. */
export const MINUTES_KEY = '__minutos__'

const MINUTES_ALIASES = new Set([
  't', 'min', 'mins', 'minutos', 'minutos jugados', 'tiempo', 'minutes', 'mp',
])

/** alias normalizado → key de métrica. */
export function buildAliasLookup(
  metrics: GpsMetric[],
  aliases: GpsMetricAlias[],
): Record<string, string> {
  const keyById = new Map(metrics.map(m => [m.id, m.key]))
  const lookup: Record<string, string> = {}
  for (const m of metrics) {
    lookup[normalizeLabel(m.label)] = m.key
    lookup[normalizeLabel(m.key)] = m.key
  }
  for (const a of aliases) {
    const key = keyById.get(a.metric_id)
    if (key) lookup[normalizeLabel(a.alias)] = key
  }
  return lookup
}

/** Propone a qué corresponde cada columna. Lo que queda en `unmapped` lo decide el usuario. */
export function mapColumns(headers: string[], lookup: Record<string, string>): ColumnMapping[] {
  return headers.map((header, index) => {
    if (index === 0) return { header, index, metricKey: null, role: 'name' as const }
    const norm = normalizeLabel(header)
    if (MINUTES_ALIASES.has(norm)) {
      return { header, index, metricKey: MINUTES_KEY, role: 'minutes' as const }
    }
    const key = lookup[norm]
    return key
      ? { header, index, metricKey: key, role: 'metric' as const }
      : { header, index, metricKey: null, role: 'unmapped' as const }
  })
}
